import { AppError } from '../../utils/errors.js';
import { getStudentTranscript } from '../students/repository.js';
import * as repo from './repository.js';

export async function enrollCurrentStudent(userId, offeringId) {
  const student = await repo.findStudentByUserId(userId);
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found for current user');
  }
  return repo.enrollStudent(student.id, offeringId, userId);
}

export async function dropEnrollment(enrollmentId, actor) {
  const enrollment = await repo.findEnrollmentWithOwner(enrollmentId);
  if (!enrollment) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found');
  }

  if (actor.role === 'student' && Number(enrollment.student_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only drop your own enrollments');
  }

  if (enrollment.status === 'completed') {
    throw new AppError(409, 'CANNOT_DROP_COMPLETED', 'Completed courses cannot be dropped');
  }
  if (enrollment.status === 'dropped') {
    throw new AppError(409, 'ALREADY_DROPPED', 'Enrollment has already been dropped');
  }

  return repo.dropEnrollment(enrollmentId, actor.id);
}

export async function getMyEnrollments(userId, termId) {
  const student = await repo.findStudentByUserId(userId);
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  }
  return repo.listStudentEnrollments(student.id, termId);
}

export async function getMyTranscript(userId) {
  const student = await repo.findStudentByUserId(userId);
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  }
  return getStudentTranscript(student.id);
}
