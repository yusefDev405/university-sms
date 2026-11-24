import { AppError } from '../../utils/errors.js';
import { gradeLetterToPoints, isNonGpaGrade } from '../../utils/grades.js';
import * as repo from './repository.js';

export async function listGradeAppeals(actor) {
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    return repo.listGradeAppeals({ studentId: st.id });
  }
  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst || !inst.is_chair) {
      throw new AppError(403, 'FORBIDDEN', 'Only department chairs or registrars can review grade appeals');
    }
    return repo.listGradeAppeals({ chairDepartmentId: inst.department_id });
  }
  return repo.listGradeAppeals({});
}

export async function createGradeAppeal({ enrollmentId, requestedReason }, actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');

  const enrollment = await repo.findEnrollmentForAppeal(enrollmentId);
  if (!enrollment) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found');
  if (Number(enrollment.student_id) !== Number(st.id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only appeal your own grades');
  }
  if (enrollment.status !== 'completed' || !enrollment.grade_letter) {
    throw new AppError(409, 'INVALID_ENROLLMENT_STATUS', 'Only graded completed courses can be appealed');
  }

  return repo.createGradeAppeal(st.id, enrollment.id, enrollment.grade_letter, requestedReason, actor.id);
}

export async function decideGradeAppeal(appealId, payload, actor) {
  const appeal = await repo.findGradeAppealById(appealId);
  if (!appeal) throw new AppError(404, 'APPEAL_NOT_FOUND', 'Grade appeal not found');

  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst || !inst.is_chair || Number(inst.department_id) !== Number(appeal.department_id)) {
      throw new AppError(403, 'FORBIDDEN', 'Only the department chair of this course or an admin can decide this appeal');
    }
  }

  let revisedPoints = null;
  if (payload.status === 'approved' && payload.revisedGrade) {
    revisedPoints = isNonGpaGrade(payload.revisedGrade) ? null : gradeLetterToPoints(payload.revisedGrade);
  }

  return repo.decideGradeAppeal(appeal, { ...payload, revisedPoints }, actor.id);
}

export async function listOverridePetitions(actor) {
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    return repo.listOverridePetitions({ studentId: st.id });
  }
  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst || !inst.is_chair) {
      throw new AppError(403, 'FORBIDDEN', 'Only department chairs or registrars can review override petitions');
    }
    return repo.listOverridePetitions({ chairDepartmentId: inst.department_id });
  }
  return repo.listOverridePetitions({});
}

export async function createOverridePetition({ offeringId, petitionType, reason }, actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  const off = await repo.findOfferingBasic(offeringId);
  if (!off) throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  return repo.createOverridePetition(st.id, off.id, petitionType, reason, actor.id);
}

export async function decideOverridePetition(id, payload, actor) {
  const petition = await repo.findOverridePetitionById(id);
  if (!petition) throw new AppError(404, 'PETITION_NOT_FOUND', 'Override petition not found');

  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst || !inst.is_chair || Number(inst.department_id) !== Number(petition.department_id)) {
      throw new AppError(403, 'FORBIDDEN', 'Only the department chair of this course or an admin can decide this petition');
    }
  }

  return repo.decideOverridePetition(petition, payload, actor.id);
}

export async function listAdvisees(actor) {
  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst) throw new AppError(404, 'INSTRUCTOR_NOT_FOUND', 'Instructor profile not found');
    return repo.listAdvisees(inst.id);
  }
  return repo.listAdvisees(null);
}

export async function listEarlyAlerts(actor) {
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    return repo.listEarlyAlerts({ studentId: st.id });
  }
  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst) throw new AppError(404, 'INSTRUCTOR_NOT_FOUND', 'Instructor profile not found');
    return repo.listEarlyAlerts({ instructorId: inst.id });
  }
  return repo.listEarlyAlerts({});
}

export async function createEarlyAlert(payload, actor) {
  const student = await repo.findStudentTargetForAlert(payload.studentId);
  if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');

  let instructorId = null;
  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst) throw new AppError(404, 'INSTRUCTOR_NOT_FOUND', 'Instructor profile not found');
    instructorId = inst.id;
  } else {
    instructorId = student.advisor_id || student.fallback_instructor_id;
  }
  if (!instructorId) {
    throw new AppError(400, 'INSTRUCTOR_REQUIRED', 'Early alerts must originate from a faculty advisor profile');
  }

  return repo.createEarlyAlert(
    { student, offeringId: payload.offeringId, instructorId, flagType: payload.flagType, note: payload.note },
    actor.id
  );
}

export async function updateEarlyAlertStatus(id, status) {
  const existing = await repo.findEarlyAlertById(id);
  if (!existing) throw new AppError(404, 'ALERT_NOT_FOUND', 'Early alert not found');
  return repo.updateEarlyAlertStatus(id, status);
}

export async function listMyDegreePlan(actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  return repo.listDegreePlanItems(st.id);
}

export async function addMyDegreePlanItem(payload, actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  return repo.upsertDegreePlanItem(st.id, payload);
}

export async function deleteMyDegreePlanItem(id, actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  const deleted = await repo.deleteDegreePlanItem(id, st.id);
  if (!deleted) throw new AppError(404, 'PLAN_ITEM_NOT_FOUND', 'Degree plan item not found');
}

export async function getCourseRelations(courseId) {
  return repo.getCourseRelations(courseId);
}

export async function setCourseCorequisites(courseId, courseIds) {
  await repo.setCourseCorequisites(courseId, courseIds);
  return repo.getCourseRelations(courseId);
}

export async function setCourseEquivalencies(courseId, courseIds) {
  await repo.setCourseEquivalencies(courseId, courseIds);
  return repo.getCourseRelations(courseId);
}
