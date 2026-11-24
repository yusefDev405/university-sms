import { query, withTransaction } from '../../config/db.js';

export async function findOfferingWithOwner(offeringId) {
  const res = await query(
    `SELECT o.id, o.course_id, c.code AS course_code, c.title AS course_title,
            o.term_id, t.name AS term_name, o.section, o.syllabus_summary,
            o.instructor_id, i.user_id AS instructor_user_id
     FROM course_offerings o
     JOIN courses c ON c.id = o.course_id
     JOIN terms t ON t.id = o.term_id
     JOIN instructors i ON i.id = o.instructor_id
     WHERE o.id = $1`,
    [offeringId]
  );
  return res.rows[0] || null;
}

export async function findStudentByUserId(userId) {
  const res = await query('SELECT id FROM students WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

export async function listAssessmentsByOffering(offeringId) {
  const res = await query(
    `SELECT id, offering_id, title, category, weight_pct::FLOAT AS weight_pct,
            max_score::FLOAT AS max_score, due_date, created_at
     FROM assessments
     WHERE offering_id = $1
     ORDER BY due_date ASC NULLS LAST, id ASC`,
    [offeringId]
  );
  return res.rows;
}

export async function findAssessmentWithOwner(assessmentId) {
  const res = await query(
    `SELECT a.id, a.offering_id, a.title, a.category, a.weight_pct::FLOAT AS weight_pct,
            a.max_score::FLOAT AS max_score, o.instructor_id, i.user_id AS instructor_user_id
     FROM assessments a
     JOIN course_offerings o ON o.id = a.offering_id
     JOIN instructors i ON i.id = o.instructor_id
     WHERE a.id = $1`,
    [assessmentId]
  );
  return res.rows[0] || null;
}

export async function createAssessment(offeringId, { title, category, weightPct, maxScore, dueDate }) {
  const res = await query(
    `INSERT INTO assessments (offering_id, title, category, weight_pct, max_score, due_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, offering_id, title, category, weight_pct::FLOAT AS weight_pct, max_score::FLOAT AS max_score, due_date, created_at`,
    [offeringId, title, category, weightPct, maxScore, dueDate || null]
  );
  return res.rows[0];
}

export async function deleteAssessment(assessmentId) {
  const res = await query('DELETE FROM assessments WHERE id = $1 RETURNING id', [assessmentId]);
  return res.rows[0] || null;
}

export async function listRosterForGradebook(offeringId) {
  const res = await query(
    `SELECT e.id AS enrollment_id, e.status, e.grade_letter, e.grade_points::FLOAT AS grade_points,
            s.id AS student_id, s.student_number, s.first_name, s.last_name
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     WHERE e.offering_id = $1 AND e.status IN ('enrolled', 'completed')
     ORDER BY s.student_number ASC`,
    [offeringId]
  );
  return res.rows;
}

export async function listScoresByOffering(offeringId) {
  const res = await query(
    `SELECT sc.id, sc.assessment_id, sc.student_id, sc.score::FLOAT AS score, sc.feedback, sc.graded_at
     FROM assessment_scores sc
     JOIN assessments a ON a.id = sc.assessment_id
     WHERE a.offering_id = $1`,
    [offeringId]
  );
  return res.rows;
}

export async function upsertAssessmentScores(assessmentId, scores, graderUserId) {
  return withTransaction(async (tx) => {
    const saved = [];
    for (const item of scores) {
      const res = await tx.query(
        `INSERT INTO assessment_scores (assessment_id, student_id, score, feedback, graded_by, graded_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (assessment_id, student_id)
         DO UPDATE SET score = EXCLUDED.score, feedback = EXCLUDED.feedback, graded_by = EXCLUDED.graded_by, graded_at = now()
         RETURNING id, assessment_id, student_id, score::FLOAT AS score, feedback, graded_at`,
        [assessmentId, item.studentId, item.score, item.feedback || null, graderUserId]
      );
      saved.push(res.rows[0]);
    }
    return saved;
  }, { actorUserId: graderUserId });
}

export async function applyComputedGrades(offeringId, items, actorUserId) {
  return withTransaction(async (tx) => {
    const results = [];
    for (const item of items) {
      const res = await tx.query(
        `UPDATE enrollments
         SET status = 'completed', grade_letter = $2, grade_points = $3
         WHERE id = $1 AND offering_id = $4
         RETURNING id, student_id, offering_id, status, grade_letter, grade_points::FLOAT AS grade_points`,
        [item.enrollmentId, item.gradeLetter, item.gradePoints, offeringId]
      );
      if (res.rows[0]) results.push(res.rows[0]);
    }
    return results;
  }, { actorUserId });
}

export async function listAnnouncements(offeringId) {
  const res = await query(
    `SELECT ca.id, ca.offering_id, ca.title, ca.body, ca.created_at,
            COALESCE(i.title || ' ' || i.first_name || ' ' || i.last_name, u.email) AS author_name
     FROM course_announcements ca
     JOIN users u ON u.id = ca.author_user_id
     LEFT JOIN instructors i ON i.user_id = u.id
     WHERE ca.offering_id = $1
     ORDER BY ca.created_at DESC, ca.id DESC`,
    [offeringId]
  );
  return res.rows;
}

export async function createAnnouncement(offeringId, authorUserId, courseCode, { title, body }) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO course_announcements (offering_id, author_user_id, title, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, offering_id, author_user_id, title, body, created_at`,
      [offeringId, authorUserId, title, body]
    );

    const studentsRes = await tx.query(
      `SELECT DISTINCT s.user_id
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       WHERE e.offering_id = $1 AND e.status IN ('enrolled', 'completed')`,
      [offeringId]
    );
    for (const st of studentsRes.rows) {
      await tx.query(
        `INSERT INTO notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [st.user_id, `${courseCode}: ${title}`, body]
      );
    }
    return res.rows[0];
  }, { actorUserId: authorUserId });
}

export async function updateSyllabus(offeringId, syllabusSummary) {
  const res = await query(
    `UPDATE course_offerings SET syllabus_summary = $2
     WHERE id = $1
     RETURNING id, syllabus_summary`,
    [offeringId, syllabusSummary]
  );
  return res.rows[0] || null;
}

export async function listStudentCourseworkOfferings(studentId) {
  const res = await query(
    `SELECT e.id AS enrollment_id, e.status, e.grade_letter,
            o.id AS offering_id, o.section, o.room, o.syllabus_summary,
            c.code AS course_code, c.title AS course_title, c.credits,
            t.id AS term_id, t.name AS term_name,
            i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name
     FROM enrollments e
     JOIN course_offerings o ON o.id = e.offering_id
     JOIN courses c ON c.id = o.course_id
     JOIN terms t ON t.id = o.term_id
     JOIN instructors i ON i.id = o.instructor_id
     WHERE e.student_id = $1 AND e.status IN ('enrolled', 'completed')
     ORDER BY t.start_date DESC, c.code ASC`,
    [studentId]
  );
  return res.rows;
}
