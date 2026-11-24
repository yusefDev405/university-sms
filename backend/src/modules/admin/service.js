import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { parsePagination } from '../../utils/pagination.js';
import * as repo from './repository.js';

export async function getEnrollmentByDepartmentReport() {
  return repo.getEnrollmentByDepartmentReport();
}

export async function listAuditLog(rawQuery) {
  const { page, limit, offset } = parsePagination(rawQuery, { defaultSort: 'created_at' });
  const { rows, total } = await repo.listAuditLog({
    entity: rawQuery.entity,
    from: rawQuery.from,
    to: rawQuery.to,
    limit,
    offset
  });
  return { data: rows, meta: { page, limit, total } };
}

const csvRowSchema = z.object({
  email: z.string().trim().email(),
  student_number: z.string().trim().min(3).max(32),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  department_code: z.string().trim().min(2).max(16)
});

export async function importStudentsCsv(csvText, actorUserId) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { importedCount: 0, rejectedCount: 0, imported: [], errors: [] };
  }

  const headerParts = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const hasHeader = headerParts.includes('email') && headerParts.includes('student_number');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const startLine = hasHeader ? 2 : 1;

  const deptMap = await repo.getDepartmentsMap();
  const rounds = env.NODE_ENV === 'test' ? 6 : 12;
  const defaultPasswordHash = await bcrypt.hash('Student123!', rounds);

  const validRows = [];
  const errors = [];
  const seenEmails = new Set();
  const seenNumbers = new Set();

  dataLines.forEach((line, idx) => {
    const lineNumber = startLine + idx;
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length < 6) {
      errors.push({ line: lineNumber, raw: line, error: 'Expected 6 comma-separated columns: email,student_number,first_name,last_name,date_of_birth,department_code' });
      return;
    }

    const candidate = {
      email: cols[0],
      student_number: cols[1],
      first_name: cols[2],
      last_name: cols[3],
      date_of_birth: cols[4],
      department_code: cols[5].toUpperCase()
    };

    const parsed = csvRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ line: lineNumber, raw: line, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      return;
    }

    const departmentId = deptMap.get(parsed.data.department_code);
    if (!departmentId) {
      errors.push({ line: lineNumber, raw: line, error: `Unknown department_code "${parsed.data.department_code}"` });
      return;
    }

    const emailKey = parsed.data.email.toLowerCase();
    if (seenEmails.has(emailKey) || seenNumbers.has(parsed.data.student_number)) {
      errors.push({ line: lineNumber, raw: line, error: 'Duplicate email or student_number inside CSV batch' });
      return;
    }

    seenEmails.add(emailKey);
    seenNumbers.add(parsed.data.student_number);

    validRows.push({
      email: parsed.data.email,
      studentNumber: parsed.data.student_number,
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      dateOfBirth: parsed.data.date_of_birth,
      departmentId,
      passwordHash: defaultPasswordHash
    });
  });

  const imported = validRows.length > 0 ? await repo.bulkInsertStudents(validRows, actorUserId) : [];

  return {
    importedCount: imported.length,
    rejectedCount: errors.length,
    imported,
    errors
  };
}
