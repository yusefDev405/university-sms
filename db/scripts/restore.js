import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as defaultDb from '../../backend/src/config/db.js';
import { BACKUP_TABLES } from './backup.js';

const IDENTITY_TABLES = new Set([
  'departments',
  'users',
  'students',
  'instructors',
  'courses',
  'terms',
  'course_offerings',
  'offering_meetings',
  'enrollments',
  'attendance_sessions',
  'attendance_records',
  'refresh_tokens',
  'audit_log'
]);

export async function restoreBackup(db, dumpPath) {
  const compressed = fs.readFileSync(dumpPath);
  const shaFile = `${dumpPath}.sha256`;
  if (fs.existsSync(shaFile)) {
    const expected = fs.readFileSync(shaFile, 'utf8').trim().split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(compressed).digest('hex');
    if (expected !== actual) {
      throw new Error(`Checksum mismatch on ${dumpPath}`);
    }
  }

  const snapshot = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));

  // Temporarily disable triggers during bulk restore so audit_log isn't duplicated
  await db.exec('ALTER TABLE enrollments DISABLE TRIGGER ALL;');
  await db.exec('ALTER TABLE terms DISABLE TRIGGER ALL;');
  await db.exec('ALTER TABLE courses DISABLE TRIGGER ALL;');

  try {
    await db.withTransaction(async (tx) => {
      for (const table of [...BACKUP_TABLES].reverse()) {
        await tx.query(`DELETE FROM ${table}`); // sql-safe: fixed allowlist BACKUP_TABLES
      }

      for (const table of BACKUP_TABLES) {
        const rows = snapshot.tables[table] || [];
        if (rows.length === 0) continue;
        const cols = Object.keys(rows[0]);
        const colList = cols.join(', ');
        const overrideClause = IDENTITY_TABLES.has(table) ? ' OVERRIDING SYSTEM VALUE' : '';

        for (const row of rows) {
          const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
          const values = cols.map((c) => row[c]);
          await tx.query(
            `INSERT INTO ${table} (${colList})${overrideClause} VALUES (${placeholders})`, // sql-safe: internal dump columns
            values
          );
        }

        if (IDENTITY_TABLES.has(table)) {
          await tx.query(
            `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`, // sql-safe: fixed allowlist BACKUP_TABLES
            [table]
          );
        }
      }
    });
  } finally {
    await db.exec('ALTER TABLE enrollments ENABLE TRIGGER ALL;');
    await db.exec('ALTER TABLE terms ENABLE TRIGGER ALL;');
    await db.exec('ALTER TABLE courses ENABLE TRIGGER ALL;');
  }

  const restoredCounts = {};
  for (const table of BACKUP_TABLES) {
    const res = await db.query(`SELECT count(*)::INT AS cnt FROM ${table}`); // sql-safe: fixed allowlist BACKUP_TABLES
    restoredCounts[table] = res.rows[0].cnt;
  }

  return { expectedCounts: snapshot.counts, restoredCounts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('Usage: node db/scripts/restore.js <path-to-dump.json.gz>');
    process.exit(1);
  }
  try {
    await defaultDb.initDb();
    const res = await restoreBackup(defaultDb, dumpPath);
    console.log('[restore] Restored row counts:', res.restoredCounts);
  } finally {
    await defaultDb.closeDb();
  }
}
