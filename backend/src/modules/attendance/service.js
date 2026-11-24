import { AppError } from '../../utils/errors.js';
import * as repo from './repository.js';

export async function getOfferingAttendance(offeringId, actor) {
  const offering = await repo.findOfferingWithInstructor(offeringId);
  if (!offering) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  }
  if (actor.role === 'instructor' && Number(offering.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view attendance for your own course offerings');
  }
  const data = await repo.getOfferingAttendance(offeringId);
  return { offering, ...data };
}

export async function recordAttendance(offeringId, body, actor) {
  const offering = await repo.findOfferingWithInstructor(offeringId);
  if (!offering) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  }
  if (actor.role === 'instructor' && Number(offering.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only record attendance for your own course offerings');
  }
  return repo.recordAttendanceSession(offeringId, body, actor.id);
}

export async function getMyAttendance(userId) {
  const studentId = await repo.findStudentIdByUserId(userId);
  if (!studentId) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  }
  return repo.getStudentAttendance(studentId);
}
