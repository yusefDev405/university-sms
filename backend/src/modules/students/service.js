import { AppError } from '../../utils/errors.js';
import { parsePagination } from '../../utils/pagination.js';
import * as repo from './repository.js';

export async function listStudents(rawQuery, actor) {
  const { page, limit, offset, sortColumn, sortDirection } = parsePagination(rawQuery, {
    allowedSorts: ['created_at', 'student_number', 'last_name'],
    defaultSort: 'student_number'
  });

  const instructorUserId = actor.role === 'instructor' ? actor.id : null;
  const { rows, total } = await repo.listStudents({
    department: rawQuery.department,
    status: rawQuery.status,
    search: rawQuery.search,
    instructorUserId,
    limit,
    offset,
    sortColumn,
    sortDirection
  });

  return { data: rows, meta: { page, limit, total } };
}

export async function getStudentById(studentId, actor) {
  if (actor.role === 'instructor') {
    const allowed = await repo.isStudentInInstructorRoster(studentId, actor.id);
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'Instructors can only view students enrolled in their offerings');
    }
  }

  const student = await repo.findStudentById(studentId);
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }
  return student;
}

export async function createStudent(body) {
  return repo.createStudent(body);
}

export async function updateStudent(id, body) {
  const updated = await repo.updateStudent(id, body);
  if (!updated) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }
  return updated;
}

export async function getStudentTranscript(studentId) {
  const transcript = await repo.getStudentTranscript(studentId);
  if (!transcript) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }
  return transcript;
}
