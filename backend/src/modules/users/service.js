import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { parsePagination } from '../../utils/pagination.js';
import * as repo from './repository.js';

export async function listUsers(rawQuery) {
  const { page, limit, offset, sortColumn, sortDirection } = parsePagination(rawQuery, {
    allowedSorts: ['created_at', 'email', 'role'],
    defaultSort: '-created_at'
  });

  const { rows, total } = await repo.listUsers({
    role: rawQuery.role,
    active: rawQuery.active,
    search: rawQuery.search,
    limit,
    offset,
    sortColumn,
    sortDirection
  });

  return { data: rows, meta: { page, limit, total } };
}

export async function createUser(body, actorUserId) {
  if (body.role === 'student' && !body.studentProfile) {
    throw new AppError(400, 'VALIDATION_ERROR', 'studentProfile is required when role is student');
  }
  if (body.role === 'instructor' && !body.instructorProfile) {
    throw new AppError(400, 'VALIDATION_ERROR', 'instructorProfile is required when role is instructor');
  }

  const rounds = env.NODE_ENV === 'test' ? 6 : 12;
  const passwordHash = await bcrypt.hash(body.password, rounds);
  return repo.createUserWithProfile(
    {
      email: body.email,
      passwordHash,
      role: body.role,
      isActive: body.isActive,
      studentProfile: body.studentProfile,
      instructorProfile: body.instructorProfile
    },
    actorUserId
  );
}

export async function updateUser(id, body) {
  const updated = await repo.updateUser(id, body);
  if (!updated) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return updated;
}

export async function listInstructors() {
  return repo.listInstructors();
}
