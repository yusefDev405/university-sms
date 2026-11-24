import { AppError } from '../../utils/errors.js';
import { gradeLetterToPoints } from '../../utils/grades.js';
import * as repo from './repository.js';

export async function setSingleGrade(enrollmentId, gradeLetter, actor) {
  const enrollment = await repo.findEnrollmentForGrading(enrollmentId);
  if (!enrollment) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found');
  }

  if (actor.role === 'instructor' && Number(enrollment.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only grade students in your own course offerings');
  }

  if (enrollment.status === 'dropped' || enrollment.status === 'waitlisted') {
    throw new AppError(409, 'INVALID_ENROLLMENT_STATUS', 'Only enrolled or completed records can be graded');
  }

  const gradePoints = gradeLetterToPoints(gradeLetter);
  if (gradePoints === null) {
    throw new AppError(400, 'INVALID_GRADE', 'Unsupported grade letter');
  }

  return repo.setSingleGrade(enrollmentId, gradeLetter, gradePoints, actor.id);
}

export async function setBulkGrades(offeringId, grades, actor) {
  const offering = await repo.findOfferingOwner(offeringId);
  if (!offering) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  }

  if (actor.role === 'instructor' && Number(offering.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only grade students in your own course offerings');
  }

  const prepared = grades.map((g) => {
    const gradePoints = gradeLetterToPoints(g.gradeLetter);
    if (gradePoints === null) {
      throw new AppError(400, 'INVALID_GRADE', `Unsupported grade letter: ${g.gradeLetter}`);
    }
    return { ...g, gradePoints };
  });

  return repo.setBulkGrades(offeringId, prepared, actor.id);
}
