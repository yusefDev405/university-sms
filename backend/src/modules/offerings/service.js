import { AppError } from '../../utils/errors.js';
import { parsePagination } from '../../utils/pagination.js';
import * as repo from './repository.js';

export async function listOfferings(rawQuery, actor) {
  const { page, limit, offset } = parsePagination(rawQuery, { defaultSort: 'id' });
  const instructorUserId = rawQuery.mine === 'true' && actor.role === 'instructor' ? actor.id : null;

  const { rows, total } = await repo.listOfferings({
    termId: rawQuery.termId,
    department: rawQuery.department,
    search: rawQuery.search,
    instructorUserId,
    limit,
    offset
  });

  return { data: rows, meta: { page, limit, total } };
}

export async function getOfferingById(id) {
  const offering = await repo.findOfferingById(id);
  if (!offering) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  }
  return offering;
}

export async function createOffering(body) {
  return repo.createOffering(body);
}

export async function updateOffering(id, body) {
  const updated = await repo.updateOffering(id, body);
  if (!updated) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  }
  return updated;
}

export async function getOfferingRoster(offeringId, actor) {
  const offering = await repo.findOfferingById(offeringId);
  if (!offering) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  }
  if (actor.role === 'instructor' && Number(offering.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view rosters for your own course offerings');
  }
  const roster = await repo.getOfferingRoster(offeringId);
  return { offering, roster };
}

export async function getGradeDistribution(offeringId, actor) {
  const offering = await repo.findOfferingById(offeringId);
  if (!offering) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  }
  if (actor.role === 'instructor' && Number(offering.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view grade distributions for your own course offerings');
  }
  const distribution = await repo.getGradeDistribution(offeringId);
  const roster = await repo.getOfferingRoster(offeringId);
  const graded = roster.filter((r) => r.status === 'completed' && r.grade_points !== null);
  const gradedCount = graded.length;
  const averagePoints =
    gradedCount > 0
      ? Number((graded.reduce((sum, r) => sum + Number(r.grade_points), 0) / gradedCount).toFixed(2))
      : null;
  return { offering, distribution, gradedCount, averagePoints };
}
