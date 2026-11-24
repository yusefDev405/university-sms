import { query, withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

export async function findOfferingWithInstructor(offeringId) {
  const res = await query(
    `SELECT o.id, o.instructor_id, i.user_id AS instructor_user_id,
            c.code AS course_code, c.title AS course_title, o.section, t.name AS term_name
     FROM course_offerings o
     JOIN courses c ON c.id = o.course_id
     JOIN terms t ON t.id = o.term_id
     JOIN instructors i ON i.id = o.instructor_id
     WHERE o.id = $1`,
    [offeringId]
  );
  return res.rows[0] || null;
}

export async function getOfferingAttendance(offeringId) {
  const [sessionsRes, summaryRes, recordsRes] = await Promise.all([
    query(
      `SELECT id, offering_id, session_date, topic, created_at
       FROM attendance_sessions
       WHERE offering_id = $1
       ORDER BY session_date DESC, id DESC`,
      [offeringId]
    ),
    query(
      `SELECT student_id, student_number, first_name, last_name,
              sessions_recorded, present_count, late_count, absent_count, excused_count, attendance_pct
       FROM v_attendance_summary
       WHERE offering_id = $1
       ORDER BY student_number ASC`,
      [offeringId]
    ),
    query(
      `SELECT ar.session_id, ar.student_id, ar.status, ar.note
       FROM attendance_records ar
       JOIN attendance_sessions ats ON ats.id = ar.session_id
       WHERE ats.offering_id = $1`,
      [offeringId]
    )
  ]);

  const bySession = new Map();
  for (const r of recordsRes.rows) {
    const list = bySession.get(r.session_id) || [];
    list.push(r);
    bySession.set(r.session_id, list);
  }

  return {
    sessions: sessionsRes.rows.map((s) => ({
      ...s,
      records: bySession.get(s.id) || []
    })),
    summary: summaryRes.rows
  };
}

export async function recordAttendanceSession(offeringId, { sessionDate, topic, records }, actorUserId) {
  return withTransaction(async (tx) => {
    const enrolledRes = await tx.query(
      `SELECT student_id FROM enrollments
       WHERE offering_id = $1 AND status IN ('enrolled', 'completed')`,
      [offeringId]
    );
    const enrolledSet = new Set(enrolledRes.rows.map((r) => Number(r.student_id)));

    for (const rec of records) {
      if (!enrolledSet.has(Number(rec.studentId))) {
        throw new AppError(409, 'STUDENT_NOT_IN_OFFERING', `Student ${rec.studentId} is not enrolled in this offering`);
      }
    }

    const sessionRes = await tx.query(
      `INSERT INTO attendance_sessions (offering_id, session_date, topic, created_by)
       VALUES ($1, $2::DATE, $3, $4)
       ON CONFLICT (offering_id, session_date)
       DO UPDATE SET topic = EXCLUDED.topic
       RETURNING id, offering_id, session_date, topic, created_at`,
      [offeringId, sessionDate, topic, actorUserId]
    );
    const session = sessionRes.rows[0];

    for (const rec of records) {
      await tx.query(
        `INSERT INTO attendance_records (session_id, student_id, status, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, recorded_at = now()`,
        [session.id, rec.studentId, rec.status, rec.note || null]
      );
    }

    return session;
  }, { actorUserId });
}

export async function findStudentIdByUserId(userId) {
  const res = await query('SELECT id FROM students WHERE user_id = $1', [userId]);
  return res.rows[0]?.id || null;
}

export async function getStudentAttendance(studentId) {
  const [summaryRes, recentRes] = await Promise.all([
    query(
      `SELECT offering_id, course_code, course_title, section, term_name,
              sessions_recorded, present_count, late_count, absent_count, excused_count, attendance_pct
       FROM v_attendance_summary
       WHERE student_id = $1
       ORDER BY term_name DESC, course_code ASC`,
      [studentId]
    ),
    query(
      `SELECT ats.session_date, ats.topic, c.code AS course_code, c.title AS course_title, ar.status, ar.note
       FROM attendance_records ar
       JOIN attendance_sessions ats ON ats.id = ar.session_id
       JOIN course_offerings o ON o.id = ats.offering_id
       JOIN courses c ON c.id = o.course_id
       WHERE ar.student_id = $1
       ORDER BY ats.session_date DESC
       LIMIT 30`,
      [studentId]
    )
  ]);

  return {
    summary: summaryRes.rows,
    recent: recentRes.rows
  };
}
