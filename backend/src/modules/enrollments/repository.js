import { query, withTransaction } from '../../config/db.js';

export async function findStudentByUserId(userId) {
  const res = await query('SELECT id, user_id, student_number FROM students WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

export async function enrollStudent(studentId, offeringId, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      'SELECT enroll_student($1, $2) AS status',
      [studentId, offeringId]
    );
    const enrollmentRes = await tx.query(
      `SELECT id, student_id, offering_id, status, enrolled_at
       FROM enrollments
       WHERE student_id = $1 AND offering_id = $2`,
      [studentId, offeringId]
    );
    return {
      status: res.rows[0].status,
      enrollment: enrollmentRes.rows[0]
    };
  }, { actorUserId });
}

export async function findEnrollmentWithOwner(enrollmentId) {
  const res = await query(
    `SELECT e.id, e.student_id, e.offering_id, e.status, s.user_id AS student_user_id
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     WHERE e.id = $1`,
    [enrollmentId]
  );
  return res.rows[0] || null;
}

export async function dropEnrollment(enrollmentId, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `UPDATE enrollments
       SET status = 'dropped'
       WHERE id = $1
       RETURNING id, student_id, offering_id, status`,
      [enrollmentId]
    );
    return res.rows[0] || null;
  }, { actorUserId });
}

export async function listStudentEnrollments(studentId, termId) {
  const params = [studentId];
  let termFilter = '';
  if (termId) {
    params.push(termId);
    termFilter = `AND o.term_id = $${params.length}`;
  }

  const res = await query(
    `SELECT e.id AS enrollment_id, e.status, e.enrolled_at, e.grade_letter, e.grade_points,
            o.id AS offering_id, o.section, o.room, o.term_id, t.name AS term_name,
            c.id AS course_id, c.code AS course_code, c.title AS course_title, c.credits,
            i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name,
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'day_of_week', m.day_of_week,
                 'start_time', to_char(m.start_time, 'HH24:MI'),
                 'end_time', to_char(m.end_time, 'HH24:MI')
               ) ORDER BY m.day_of_week, m.start_time)
               FROM offering_meetings m WHERE m.offering_id = o.id),
              '[]'::json
            ) AS meetings
     FROM enrollments e
     JOIN course_offerings o ON o.id = e.offering_id
     JOIN courses c ON c.id = o.course_id
     JOIN terms t ON t.id = o.term_id
     JOIN instructors i ON i.id = o.instructor_id
     WHERE e.student_id = $1 ${termFilter}
     ORDER BY t.start_date DESC, c.code ASC`, // sql-safe: parameterized termFilter
    params
  );
  return res.rows;
}
