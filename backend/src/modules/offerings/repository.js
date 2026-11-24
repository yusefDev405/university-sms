import { query, withTransaction } from '../../config/db.js';

export async function listOfferings({ termId, department, search, instructorUserId, limit, offset }) {
  const conditions = [];
  const params = [];

  if (termId) {
    params.push(termId);
    conditions.push(`v.term_id = $${params.length}`);
  }
  if (department) {
    params.push(department);
    conditions.push(`v.department_code = upper($${params.length})`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(v.course_code ILIKE $${params.length} OR v.course_title ILIKE $${params.length} OR v.instructor_name ILIKE $${params.length})`);
  }
  if (instructorUserId) {
    params.push(instructorUserId);
    conditions.push(`i.user_id = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT count(*)::INT AS total
     FROM v_offering_availability v
     JOIN instructors i ON i.id = v.instructor_id
     ${where}`, // sql-safe: parameterized filters
    params
  );

  const listParams = [...params, limit, offset];
  const rowsRes = await query(
    `SELECT v.*,
            (now() BETWEEN v.registration_opens AND v.registration_closes) AS is_registration_open,
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'id', m.id,
                 'day_of_week', m.day_of_week,
                 'start_time', to_char(m.start_time, 'HH24:MI'),
                 'end_time', to_char(m.end_time, 'HH24:MI')
               ) ORDER BY m.day_of_week, m.start_time)
               FROM offering_meetings m WHERE m.offering_id = v.offering_id),
              '[]'::json
            ) AS meetings,
            COALESCE(
              (SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'title', p.title) ORDER BY p.code)
               FROM course_prerequisites cp
               JOIN courses p ON p.id = cp.prerequisite_id
               WHERE cp.course_id = v.course_id),
              '[]'::json
            ) AS prerequisites
     FROM v_offering_availability v
     JOIN instructors i ON i.id = v.instructor_id
     ${where}
     ORDER BY v.term_id DESC, v.course_code ASC, v.section ASC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, // sql-safe: parameterized limit/offset
    listParams
  );

  return { rows: rowsRes.rows, total: countRes.rows[0].total };
}

export async function findOfferingById(offeringId) {
  const res = await query(
    `SELECT v.*,
            i.user_id AS instructor_user_id,
            (now() BETWEEN v.registration_opens AND v.registration_closes) AS is_registration_open,
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'id', m.id,
                 'day_of_week', m.day_of_week,
                 'start_time', to_char(m.start_time, 'HH24:MI'),
                 'end_time', to_char(m.end_time, 'HH24:MI')
               ) ORDER BY m.day_of_week, m.start_time)
               FROM offering_meetings m WHERE m.offering_id = v.offering_id),
              '[]'::json
            ) AS meetings,
            COALESCE(
              (SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'title', p.title) ORDER BY p.code)
               FROM course_prerequisites cp
               JOIN courses p ON p.id = cp.prerequisite_id
               WHERE cp.course_id = v.course_id),
              '[]'::json
            ) AS prerequisites
     FROM v_offering_availability v
     JOIN instructors i ON i.id = v.instructor_id
     WHERE v.offering_id = $1`,
    [offeringId]
  );
  return res.rows[0] || null;
}

export async function createOffering(data) {
  const createdId = await withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO course_offerings (course_id, term_id, instructor_id, section, capacity, room)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.courseId, data.termId, data.instructorId, data.section, data.capacity, data.room]
    );
    const offeringId = res.rows[0].id;

    for (const m of data.meetings || []) {
      await tx.query(
        `INSERT INTO offering_meetings (offering_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3::TIME, $4::TIME)`,
        [offeringId, m.dayOfWeek, m.startTime, m.endTime]
      );
    }
    return offeringId;
  });

  return findOfferingById(createdId);
}

export async function updateOffering(id, data) {
  const found = await withTransaction(async (tx) => {
    const map = {
      instructorId: 'instructor_id',
      section: 'section',
      capacity: 'capacity',
      room: 'room'
    };
    const sets = [];
    const params = [];
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        params.push(data[k]);
        sets.push(`${col} = $${params.length}`);
      }
    }

    if (sets.length > 0) {
      params.push(id);
      const res = await tx.query(
        `UPDATE course_offerings SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`, // sql-safe: fixed column mapping
        params
      );
      if (!res.rows[0]) return false;
    } else {
      const exists = await tx.query('SELECT id FROM course_offerings WHERE id = $1', [id]);
      if (!exists.rows[0]) return false;
    }

    if (data.meetings !== undefined) {
      await tx.query('DELETE FROM offering_meetings WHERE offering_id = $1', [id]);
      for (const m of data.meetings) {
        await tx.query(
          `INSERT INTO offering_meetings (offering_id, day_of_week, start_time, end_time)
           VALUES ($1, $2, $3::TIME, $4::TIME)`,
          [id, m.dayOfWeek, m.startTime, m.endTime]
        );
      }
    }
    return true;
  });

  if (!found) return null;
  return findOfferingById(id);
}

export async function getOfferingRoster(offeringId) {
  const res = await query(
    `SELECT enrollment_id, offering_id, student_id, student_number, first_name, last_name,
            email, department_code, status, grade_letter, grade_points, enrolled_at
     FROM v_instructor_roster
     WHERE offering_id = $1
     ORDER BY CASE status WHEN 'enrolled' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
              enrolled_at ASC, student_number ASC`,
    [offeringId]
  );
  return res.rows;
}

export async function getGradeDistribution(offeringId) {
  const res = await query(
    `SELECT grade_letter, count(*)::INT AS count
     FROM enrollments
     WHERE offering_id = $1 AND status = 'completed' AND grade_letter IS NOT NULL
     GROUP BY grade_letter
     ORDER BY MIN(grade_points) DESC`,
    [offeringId]
  );
  return res.rows;
}
