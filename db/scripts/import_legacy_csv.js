import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as defaultDb from '../../backend/src/config/db.js';

const require = createRequire(import.meta.url);
const bcrypt = require('../../backend/node_modules/bcryptjs');

async function importLegacyCsv(csvPath) {
  const absPath = path.resolve(csvPath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    console.log('Empty CSV file; nothing to import.');
    return;
  }

  const headerParts = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const hasHeader = headerParts.includes('email') && headerParts.includes('student_number');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const startLine = hasHeader ? 2 : 1;

  await defaultDb.initDb();
  try {
    const deptRes = await defaultDb.query('SELECT id, code FROM departments');
    const deptMap = new Map(deptRes.rows.map((d) => [d.code.toUpperCase(), d.id]));

    const existingEmailsRes = await defaultDb.query('SELECT lower(email) AS email FROM users');
    const existingEmails = new Set(existingEmailsRes.rows.map((r) => r.email));
    const existingNumbersRes = await defaultDb.query('SELECT student_number FROM students');
    const existingNumbers = new Set(existingNumbersRes.rows.map((r) => r.student_number));

    const validRows = [];
    const badRows = [];

    dataLines.forEach((line, idx) => {
      const lineNo = startLine + idx;
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 6) {
        badRows.push(`${lineNo},"${line.replaceAll('"', '""')}",Expected 6 columns`);
        return;
      }
      const [email, studentNumber, firstName, lastName, dob, deptCode] = cols;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        badRows.push(`${lineNo},"${line.replaceAll('"', '""')}",Invalid email`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        badRows.push(`${lineNo},"${line.replaceAll('"', '""')}",Invalid date_of_birth (expected YYYY-MM-DD)`);
        return;
      }
      const departmentId = deptMap.get(deptCode.toUpperCase());
      if (!departmentId) {
        badRows.push(`${lineNo},"${line.replaceAll('"', '""')}",Unknown department_code ${deptCode}`);
        return;
      }
      if (existingEmails.has(email.toLowerCase()) || existingNumbers.has(studentNumber)) {
        badRows.push(`${lineNo},"${line.replaceAll('"', '""')}",Duplicate email or student_number`);
        return;
      }

      existingEmails.add(email.toLowerCase());
      existingNumbers.add(studentNumber);
      validRows.push({ email, studentNumber, firstName, lastName, dob, departmentId });
    });

    const passwordHash = await bcrypt.hash('Student123!', 12);
    if (validRows.length > 0) {
      await defaultDb.withTransaction(async (tx) => {
        for (const r of validRows) {
          const uRes = await tx.query(
            `INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, 'student', true) RETURNING id`,
            [r.email, passwordHash]
          );
          await tx.query(
            `INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id, status)
             VALUES ($1, $2, $3, $4, $5::DATE, $6, 'active')`,
            [uRes.rows[0].id, r.studentNumber, r.firstName, r.lastName, r.dob, r.departmentId]
          );
        }
      });
    }

    const errFile = absPath.replace(/\.csv$/i, '.errors.csv');
    if (badRows.length > 0) {
      fs.writeFileSync(errFile, 'line,raw_row,reason\n' + badRows.join('\n') + '\n', 'utf8');
      console.log(`[import-csv] Imported ${validRows.length} student(s). Rejected ${badRows.length} row(s) -> ${errFile}`);
    } else {
      console.log(`[import-csv] Imported ${validRows.length} student(s) with 0 errors.`);
    }
  } finally {
    await defaultDb.closeDb();
  }
}

const inputPath = process.argv[2] || 'db/seeds/legacy_students_sample.csv';
importLegacyCsv(inputPath).catch((err) => {
  console.error(err);
  process.exit(1);
});
