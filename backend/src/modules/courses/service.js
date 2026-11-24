import { AppError } from '../../utils/errors.js';
import { parsePagination } from '../../utils/pagination.js';
import * as repo from './repository.js';

export async function listCourses(rawQuery) {
  const { page, limit, offset, sortColumn, sortDirection } = parsePagination(rawQuery, {
    allowedSorts: ['code', 'title', 'credits'],
    defaultSort: 'code'
  });

  const { rows, total } = await repo.listCourses({
    department: rawQuery.department,
    search: rawQuery.search,
    limit,
    offset,
    sortColumn,
    sortDirection
  });

  return { data: rows, meta: { page, limit, total } };
}

export async function getCourseById(id) {
  const course = await repo.findCourseById(id);
  if (!course) {
    throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
  }
  return course;
}

export async function createCourse(body) {
  return repo.createCourse(body);
}

export async function updateCourse(id, body) {
  const updated = await repo.updateCourse(id, body);
  if (!updated) {
    throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
  }
  return updated;
}

export async function replacePrerequisites(courseId, prerequisiteIds) {
  const existing = await repo.findCourseById(courseId);
  if (!existing) {
    throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
  }
  const uniqueIds = [...new Set(prerequisiteIds)];
  if (uniqueIds.includes(courseId)) {
    throw new AppError(400, 'INVALID_PREREQUISITE', 'A course cannot be its own prerequisite');
  }
  return repo.replacePrerequisites(courseId, uniqueIds);
}
