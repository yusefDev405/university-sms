import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as defaultDb from '../../backend/src/config/db.js';

const require = createRequire(import.meta.url);
const bcrypt = require('../../backend/node_modules/bcryptjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SEED_FILE = path.resolve(__dirname, '../seeds/seed_small.sql');

export async function runSeed(db = defaultDb, { force = false } = {}) {
  const existing = await db.query('SELECT count(*)::INT AS cnt FROM departments');
  if (existing.rows[0].cnt > 0 && !force) {
    return { skipped: true };
  }

  // Cost 10 in test for speed, cost 12 in development/production per security checklist
  const rounds = process.env.NODE_ENV === 'test' ? 6 : 12;
  const [adminHash, instructorHash, studentHash] = await Promise.all([
    bcrypt.hash('AdminPass123!', rounds),
    bcrypt.hash('Instructor123!', rounds),
    bcrypt.hash('Student123!', rounds)
  ]);

  let sql = fs.readFileSync(SEED_FILE, 'utf8');
  sql = sql
    .replaceAll('__ADMIN_HASH__', adminHash)
    .replaceAll('__INSTRUCTOR_HASH__', instructorHash)
    .replaceAll('__STUDENT_HASH__', studentHash);

  await db.exec(sql);
  return { skipped: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const info = await defaultDb.initDb();
    const res = await runSeed(defaultDb);
    console.log(
      res.skipped
        ? `[seed:${info.mode}] Existing records found; skipping seed.`
        : `[seed:${info.mode}] Seeded compact realistic dataset.`
    );
  } finally {
    await defaultDb.closeDb();
  }
}
