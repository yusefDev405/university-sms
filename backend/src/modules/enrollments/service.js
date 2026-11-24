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

export async function swapEnrollment(userId, dropEnrollmentId, targetOfferingId) {
  const student = await repo.findStudentByUserId(userId);
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  }
  const existing = await repo.findEnrollmentWithOwner(dropEnrollmentId);
  if (!existing) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment to drop not found');
  }
  if (Number(existing.student_user_id) !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only swap your own enrollments');
  }
  if (existing.status !== 'enrolled' && existing.status !== 'waitlisted') {
    throw new AppError(409, 'INVALID_SWAP_STATUS', 'Only active or waitlisted enrollments can be swapped');
  }
  if (Number(existing.offering_id) === Number(targetOfferingId)) {
    throw new AppError(400, 'SAME_OFFERING', 'Target offering must differ from the current offering');
  }
  return repo.swapEnrollment(student.id, dropEnrollmentId, targetOfferingId, userId);
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
  if (enrollment.status === 'dropped' || enrollment.status === 'withdrawn') {
    throw new AppError(409, 'ALREADY_DROPPED', 'Enrollment has already been dropped or withdrawn');
  }

  const now = Date.now();
  const regCloses = new Date(enrollment.registration_closes).getTime();
  const withdrawCloses = enrollment.withdrawal_closes ? new Date(enrollment.withdrawal_closes).getTime() : null;

  let withdraw = false;
  if (now > regCloses) {
    if (withdrawCloses && now <= withdrawCloses && enrollment.status === 'enrolled') {
      withdraw = true;
    } else if (actor.role === 'student') {
      throw new AppError(403, 'WITHDRAWAL_CLOSED', 'Add/drop and withdrawal deadlines for this term have passed');
    }
  }

  return repo.dropOrWithdrawEnrollment(enrollmentId, { withdraw }, actor.id);
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

export async function getMyDegreeAudit(userId) {
  const student = await repo.findStudentByUserId(userId);
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  }
  const courses = await repo.getDegreeAudit(student.id, student.department_id);
  const totalCredits = courses.reduce((sum, c) => sum + Number(c.credits), 0);
  const completedCredits = courses.filter((c) => c.is_completed).reduce((sum, c) => sum + Number(c.credits), 0);
  const inProgressCredits = courses.filter((c) => c.is_in_progress).reduce((sum, c) => sum + Number(c.credits), 0);

  return {
    totalRequiredCredits: totalCredits,
    completedCredits,
    inProgressCredits,
    remainingCredits: Math.max(0, totalCredits - completedCredits),
    courses
  };
}
