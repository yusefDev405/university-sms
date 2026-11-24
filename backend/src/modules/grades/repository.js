import { query, withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

export async function findEnrollmentForGrading(enrollmentId) {
  const res = await query(
    `SELECT e.id, e.student_id, e.offering_id, e.status,
            o.instructor_id, i.user_id AS instructor_user_id
     FROM enrollments e
     JOIN course_offerings o ON o.id = e.offering_id
     JOIN instructors i ON i.id = o.instructor_id
     WHERE e.id = $1`,
    [enrollmentId]
  );
  return res.rows[0] || null;
}

export async function findOfferingOwner(offeringId) {
  const res = await query(
    `SELECT o.id, o.instructor_id, i.user_id AS instructor_user_id
     FROM course_offerings o
     JOIN instructors i ON i.id = o.instructor_id
     WHERE o.id = $1`,
    [offeringId]
  );
  return res.rows[0] || null;
}

export async function setSingleGrade(enrollmentId, gradeLetter, gradePoints, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `UPDATE enrollments
       SET status = 'completed',
           grade_letter = $2,
           grade_points = $3
       WHERE id = $1
       RETURNING id, student_id, offering_id, status, grade_letter, grade_points`,
      [enrollmentId, gradeLetter, gradePoints]
    );
    return res.rows[0] || null;
  }, { actorUserId });
}

export async function setBulkGrades(offeringId, items, actorUserId) {
  return withTransaction(async (tx) => {
    const updated = [];
    for (const item of items) {
      const checkRes = await tx.query(
        'SELECT id, offering_id, status FROM enrollments WHERE id = $1 FOR UPDATE',
        [item.enrollmentId]
      );
      const row = checkRes.rows[0];
      if (!row || Number(row.offering_id) !== Number(offeringId)) {
        throw new AppError(409, 'BULK_GRADE_ABORTED', `Enrollment ${item.enrollmentId} does not belong to this offering`);
      }
      if (row.status === 'dropped' || row.status === 'waitlisted') {
        throw new AppError(409, 'BULK_GRADE_ABORTED', `Enrollment ${item.enrollmentId} is dropped or waitlisted and cannot be graded`);
      }

      const updRes = await tx.query(
        `UPDATE enrollments
         SET status = 'completed',
             grade_letter = $2,
             grade_points = $3
         WHERE id = $1
         RETURNING id, student_id, offering_id, status, grade_letter, grade_points`,
        [item.enrollmentId, item.gradeLetter, item.gradePoints]
      );
      updated.push(updRes.rows[0]);
    }
    return updated;
  }, { actorUserId });
}
