import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as defaultDb from '../../backend/src/config/db.js';
import { env } from '../../backend/src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKUPS_DIR = path.resolve(env.projectRoot, 'backups');

export const BACKUP_TABLES = [
  'departments',
  'rooms',
  'users',
  'instructors',
  'students',
  'courses',
  'course_prerequisites',
  'course_corequisites',
  'course_equivalencies',
  'terms',
  'course_offerings',
  'offering_meetings',
  'enrollments',
  'assessments',
  'assessment_scores',
  'course_announcements',
  'grade_appeals',
  'override_petitions',
  'early_alerts',
  'degree_plan_items',
  'admissions_applications',
  'transfer_credits',
  'graduation_applications',
  'exam_schedules',
  'office_hour_slots',
  'office_hour_bookings',
  'evaluation_submissions',
  'evaluation_responses',
  'academic_calendar_events',
  'tuition_ledger',
  'attendance_sessions',
  'attendance_records',
  'academic_holds',
  'notifications',
  'refresh_tokens',
  'audit_log'
];

export async function createBackup(db = defaultDb, outPath = null) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filePath = outPath ?? path.join(BACKUPS_DIR, `university_${dateStamp}.json.gz`);

  const tables = {};
  const counts = {};
  for (const table of BACKUP_TABLES) {
    const res = await db.query(`SELECT * FROM ${table}`); // sql-safe: fixed allowlist BACKUP_TABLES
    tables[table] = res.rows;
    counts[table] = res.rows.length;
  }

  const payload = JSON.stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    counts,
    tables
  });
  const compressed = zlib.gzipSync(Buffer.from(payload, 'utf8'));
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');

  fs.writeFileSync(filePath, compressed);
  fs.writeFileSync(`${filePath}.sha256`, `${sha256}  ${path.basename(filePath)}\n`);

  // Retention: keep last 7 dumps
  const dumps = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.json.gz'))
    .sort()
    .reverse();
  for (const old of dumps.slice(7)) {
    fs.rmSync(path.join(BACKUPS_DIR, old), { force: true });
    fs.rmSync(path.join(BACKUPS_DIR, `${old}.sha256`), { force: true });
  }

  return { filePath, sha256, bytes: compressed.length, counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await defaultDb.initDb();
    const result = await createBackup(defaultDb);
    console.log(
      `[backup] Wrote ${result.filePath} (${result.bytes} bytes, sha256=${result.sha256.slice(0, 12)}...)`
    );
  } finally {
    await defaultDb.closeDb();
  }
}
