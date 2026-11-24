import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as defaultDb from '../../backend/src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

export async function runMigrations(db = defaultDb) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/i.test(f))
    .sort();

  const appliedRes = await db.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(appliedRes.rows.map((r) => r.filename));

  const appliedNow = [];
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.exec(sql);
    await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    appliedNow.push(file);
  }
  return appliedNow;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const info = await defaultDb.initDb();
    const applied = await runMigrations(defaultDb);
    console.log(
      applied.length > 0
        ? `[migrate:${info.mode}] Applied: ${applied.join(', ')}`
        : `[migrate:${info.mode}] Schema is already up to date.`
    );
  } finally {
    await defaultDb.closeDb();
  }
}
