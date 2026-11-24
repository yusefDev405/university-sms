import { AppError } from '../../utils/errors.js';
import * as repo from './repository.js';

export async function listMyNotifications(userId) {
  return repo.listNotifications(userId);
}

export async function markNotificationRead(id, userId) {
  const updated = await repo.markNotificationRead(id, userId);
  if (!updated) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }
  return updated;
}

export async function listMyHolds(userId) {
  const studentId = await repo.findStudentIdByUserId(userId);
  if (!studentId) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  }
  return repo.listHolds({ studentId, activeOnly: true });
}

export async function listAllHolds() {
  return repo.listHolds();
}

export async function createHold(body, actorUserId) {
  return repo.createHold({ ...body, actorUserId });
}

export async function resolveHold(id, actorUserId) {
  const resolved = await repo.resolveHold(id, actorUserId);
  if (!resolved) {
    throw new AppError(404, 'HOLD_NOT_FOUND', 'Academic hold not found');
  }
  return resolved;
}
