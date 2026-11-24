import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PGlite } = require('../../backend/node_modules/@electric-sql/pglite');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

async function runExplainDemo() {
  // Pure in-memory PostgreSQL instance: 0 bytes written to disk
  const db = new PGlite();
  await db.waitReady;

  try {
    // Apply schema + views only (skip 005_indexes.sql initially so we can measure BEFORE indexing)
    for (const file of ['001_schema.sql', '002_views.sql']) {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }

    // Seed synthetic dataset in memory using generate_series
    await db.exec(`
      INSERT INTO departments (code, name)
      SELECT 'D' || g, 'Department ' || g
      FROM generate_series(1, 6) AS g;

      INSERT INTO users (email, password_hash, role)
      SELECT 'bench' || g || '@galala.edu.eg', 'x', 'student'
      FROM generate_series(1, 3000) AS g;

      INSERT INTO users (email, password_hash, role)
      SELECT 'prof' || g || '@galala.edu.eg', 'x', 'instructor'
      FROM generate_series(1, 20) AS g;

      INSERT INTO instructors (user_id, department_id, first_name, last_name, title)
      SELECT u.id, ((row_number() OVER ()) % 6) + 1, 'Prof', 'Bench' || u.id, 'Dr.'
      FROM users u WHERE u.role = 'instructor';

      INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id)
      SELECT u.id, 'S' || LPAD(u.id::TEXT, 6, '0'), 'Student', 'N' || u.id, '2004-01-01'::DATE, ((u.id - 1) % 6) + 1
      FROM users u WHERE u.role = 'student';

      INSERT INTO courses (code, title, credits, department_id)
      SELECT 'C' || g, 'Course ' || g, 3, ((g - 1) % 6) + 1
      FROM generate_series(1, 40) AS g;

      INSERT INTO terms (name, start_date, end_date, registration_opens, registration_closes)
      SELECT 'Term ' || g, ('2025-01-01'::DATE + g * 100), ('2025-03-30'::DATE + g * 100),
             now() - interval '10 days', now() + interval '10 days'
      FROM generate_series(1, 4) AS g;

      INSERT INTO course_offerings (course_id, term_id, instructor_id, section, capacity, room)
      SELECT ((g - 1) % 40) + 1, ((g - 1) % 4) + 1, ((g - 1) % 20) + 1, 'S' || g, 200, 'R' || g
      FROM generate_series(1, 160) AS g;

      -- 18,000 enrollments across 3,000 students (in-memory only, never persisted)
      INSERT INTO enrollments (student_id, offering_id, status, grade_points, grade_letter)
      SELECT
        ((g - 1) % 3000) + 1 AS student_id,
        ((g * 17) % 160) + 1 AS offering_id,
        CASE WHEN g % 5 = 0 THEN 'enrolled' ELSE 'completed' END,
        CASE WHEN g % 5 = 0 THEN NULL ELSE 3.50 END,
        CASE WHEN g % 5 = 0 THEN NULL ELSE 'A-' END
      FROM generate_series(1, 18000) AS g
      ON CONFLICT DO NOTHING;

      ANALYZE;
    `);

    const countRes = await db.query('SELECT count(*)::INT AS cnt FROM enrollments');
    const rowCount = countRes.rows[0].cnt;

    const querySql = `
      SELECT e.id, c.code, c.title, t.name AS term_name, e.grade_letter, e.grade_points
      FROM enrollments e
      JOIN course_offerings o ON o.id = e.offering_id
      JOIN courses c ON c.id = o.course_id
      JOIN terms t ON t.id = o.term_id
      WHERE e.student_id = 42 AND e.status = 'completed'
    `;

    // Force planner to evaluate index vs seq scan cleanly on 18k rows
    await db.exec('SET enable_seqscan = on;');
    const beforeRes = await db.query(`EXPLAIN (ANALYZE, BUFFERS) ${querySql}`);
    const beforePlan = beforeRes.rows.map((r) => r['QUERY PLAN']).join('\n');

    // Now apply composite & partial indexes from 005_indexes.sql + VACUUM ANALYZE
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, '005_indexes.sql'), 'utf8'));
    await db.exec('VACUUM ANALYZE;');

    const afterRes = await db.query(`EXPLAIN (ANALYZE, BUFFERS) ${querySql}`);
    const afterPlan = afterRes.rows.map((r) => r['QUERY PLAN']).join('\n');

    console.log(`=== EXPLAIN ANALYZE DEMO (In-memory PostgreSQL, ${rowCount} enrollments) ===`);
    console.log('\n--- BEFORE INDEXING ---\n' + beforePlan);
    console.log('\n--- AFTER INDEXING (idx_enrollments_student_status + VACUUM ANALYZE) ---\n' + afterPlan);
  } finally {
    await db.close();
  }
}

runExplainDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
