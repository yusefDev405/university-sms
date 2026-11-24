import { query, withTransaction } from '../../config/db.js';

export async function findStudentByUserId(userId) {
  const res = await query('SELECT id FROM students WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

export async function findInstructorByUserId(userId) {
  const res = await query('SELECT id FROM instructors WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

// --- Rooms ---
export async function listRooms() {
  const res = await query(
    'SELECT id, building, room_number, capacity, room_type, created_at FROM rooms ORDER BY building, room_number'
  );
  return res.rows;
}

export async function createRoom({ building, roomNumber, capacity, roomType }) {
  const res = await query(
    `INSERT INTO rooms (building, room_number, capacity, room_type)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [building, roomNumber, capacity, roomType]
  );
  return res.rows[0];
}

export async function deleteRoom(id) {
  const res = await query('DELETE FROM rooms WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

// --- Exam Schedules ---
export async function listExams({ termId = null, studentId = null } = {}) {
  const res = await query(
    `SELECT ex.id, ex.offering_id, ex.exam_date,
            to_char(ex.start_time, 'HH24:MI') AS start_time,
            to_char(ex.end_time, 'HH24:MI') AS end_time,
            ex.room,
            o.section, t.id AS term_id, t.name AS term_name,
            c.code AS course_code, c.title AS course_title,
            i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name
     FROM exam_schedules ex
     JOIN course_offerings o ON o.id = ex.offering_id
     JOIN courses c ON c.id = o.course_id
     JOIN terms t ON t.id = o.term_id
     JOIN instructors i ON i.id = o.instructor_id
     WHERE ($1::BIGINT IS NULL OR o.term_id = $1)
       AND (
         $2::BIGINT IS NULL OR EXISTS (
           SELECT 1 FROM enrollments e
           WHERE e.offering_id = o.id AND e.student_id = $2 AND e.status = 'enrolled'
         )
       )
     ORDER BY ex.exam_date ASC, ex.start_time ASC, c.code ASC`,
    [termId, studentId]
  );
  return res.rows;
}

export async function findExamRoomConflicts({ offeringId, examDate, startTime, endTime, room }) {
  const res = await query(
    `SELECT ex.id, c.code AS course_code, o.section
     FROM exam_schedules ex
     JOIN course_offerings o ON o.id = ex.offering_id
     JOIN courses c ON c.id = o.course_id
     WHERE ex.offering_id <> $1
       AND ex.exam_date = $2::DATE
       AND lower(ex.room) = lower($3)
       AND ex.start_time < $5::TIME
       AND $4::TIME < ex.end_time`,
    [offeringId, examDate, room, startTime, endTime]
  );
  return res.rows;
}

export async function findStudentExamConflicts({ offeringId, examDate, startTime, endTime }) {
  const res = await query(
    `SELECT DISTINCT s.student_number, c2.code AS conflicting_course
     FROM enrollments e1
     JOIN enrollments e2 ON e2.student_id = e1.student_id AND e2.offering_id <> e1.offering_id
     JOIN exam_schedules ex ON ex.offering_id = e2.offering_id
     JOIN course_offerings o2 ON o2.id = e2.offering_id
     JOIN courses c2 ON c2.id = o2.course_id
     JOIN students s ON s.id = e1.student_id
     WHERE e1.offering_id = $1
       AND e1.status = 'enrolled'
       AND e2.status = 'enrolled'
       AND ex.exam_date = $2::DATE
       AND ex.start_time < $4::TIME
       AND $3::TIME < ex.end_time`,
    [offeringId, examDate, startTime, endTime]
  );
  return res.rows;
}

export async function upsertExamSchedule({ offeringId, examDate, startTime, endTime, room }) {
  const res = await query(
    `INSERT INTO exam_schedules (offering_id, exam_date, start_time, end_time, room)
     VALUES ($1, $2::DATE, $3::TIME, $4::TIME, $5)
     ON CONFLICT (offering_id)
     DO UPDATE SET exam_date = EXCLUDED.exam_date, start_time = EXCLUDED.start_time,
                   end_time = EXCLUDED.end_time, room = EXCLUDED.room
     RETURNING id, offering_id, exam_date,
               to_char(start_time, 'HH24:MI') AS start_time,
               to_char(end_time, 'HH24:MI') AS end_time, room`,
    [offeringId, examDate, startTime, endTime, room]
  );
  return res.rows[0];
}

export async function deleteExamSchedule(id) {
  const res = await query('DELETE FROM exam_schedules WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

// --- Office Hours ---
export async function listOfficeHourSlots() {
  const res = await query(
    `SELECT oh.id, oh.instructor_id, oh.day_of_week,
            to_char(oh.start_time, 'HH24:MI') AS start_time,
            to_char(oh.end_time, 'HH24:MI') AS end_time,
            oh.location,
            i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name,
            d.code AS department_code
     FROM office_hour_slots oh
     JOIN instructors i ON i.id = oh.instructor_id
     JOIN departments d ON d.id = i.department_id
     ORDER BY oh.day_of_week ASC, oh.start_time ASC`
  );
  return res.rows;
}

export async function listOfficeHourBookings({ studentId = null, instructorId = null } = {}) {
  const res = await query(
    `SELECT ob.id, ob.slot_id, ob.student_id, ob.booking_date, ob.topic, ob.status, ob.created_at,
            to_char(oh.start_time, 'HH24:MI') AS start_time,
            to_char(oh.end_time, 'HH24:MI') AS end_time,
            oh.day_of_week, oh.location, oh.instructor_id,
            i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name,
            s.student_number, s.first_name || ' ' || s.last_name AS student_name
     FROM office_hour_bookings ob
     JOIN office_hour_slots oh ON oh.id = ob.slot_id
     JOIN instructors i ON i.id = oh.instructor_id
     JOIN students s ON s.id = ob.student_id
     WHERE ($1::BIGINT IS NULL OR ob.student_id = $1)
       AND ($2::BIGINT IS NULL OR oh.instructor_id = $2)
     ORDER BY ob.booking_date DESC, oh.start_time ASC`,
    [studentId, instructorId]
  );
  return res.rows;
}

export async function createOfficeHourSlot(instructorId, { dayOfWeek, startTime, endTime, location }) {
  const res = await query(
    `INSERT INTO office_hour_slots (instructor_id, day_of_week, start_time, end_time, location)
     VALUES ($1, $2, $3::TIME, $4::TIME, $5)
     RETURNING id, instructor_id, day_of_week,
               to_char(start_time, 'HH24:MI') AS start_time,
               to_char(end_time, 'HH24:MI') AS end_time, location`,
    [instructorId, dayOfWeek, startTime, endTime, location]
  );
  return res.rows[0];
}

export async function findOfficeHourSlotById(id) {
  const res = await query('SELECT * FROM office_hour_slots WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function deleteOfficeHourSlot(id) {
  const res = await query('DELETE FROM office_hour_slots WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

export async function createOfficeHourBooking(studentId, { slotId, bookingDate, topic }) {
  const res = await query(
    `INSERT INTO office_hour_bookings (slot_id, student_id, booking_date, topic, status)
     VALUES ($1, $2, $3::DATE, $4, 'booked')
     RETURNING *`,
    [slotId, studentId, bookingDate, topic]
  );
  return res.rows[0];
}

export async function findBookingWithOwners(id) {
  const res = await query(
    `SELECT ob.*, oh.instructor_id
     FROM office_hour_bookings ob
     JOIN office_hour_slots oh ON oh.id = ob.slot_id
     WHERE ob.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function cancelOfficeHourBooking(id) {
  const res = await query(
    "UPDATE office_hour_bookings SET status = 'cancelled' WHERE id = $1 RETURNING *",
    [id]
  );
  return res.rows[0] || null;
}

// --- Anonymous Evaluations ---
export async function listStudentEvaluationsStatus(studentId) {
  const res = await query(
    `SELECT o.id AS offering_id, o.section, c.code AS course_code, c.title AS course_title,
            t.name AS term_name,
            i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name,
            EXISTS (
              SELECT 1 FROM evaluation_submissions es
              WHERE es.offering_id = o.id AND es.student_id = $1
            ) AS already_submitted
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

export async function isStudentEnrolledInOffering(studentId, offeringId) {
  const res = await query(
    `SELECT 1 FROM enrollments
     WHERE student_id = $1 AND offering_id = $2 AND status IN ('enrolled', 'completed')`,
    [studentId, offeringId]
  );
  return res.rows.length > 0;
}

export async function submitAnonymousEvaluation(studentId, { offeringId, ratingTeaching, ratingContent, ratingFairness, comment }) {
  return withTransaction(async (tx) => {
    await tx.query(
      'INSERT INTO evaluation_submissions (offering_id, student_id) VALUES ($1, $2)',
      [offeringId, studentId]
    );
    const res = await tx.query(
      `INSERT INTO evaluation_responses (offering_id, rating_teaching, rating_content, rating_fairness, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, offering_id, rating_teaching, rating_content, rating_fairness, created_at`,
      [offeringId, ratingTeaching, ratingContent, ratingFairness, comment || null]
    );
    return res.rows[0];
  });
}

export async function getOfferingOwner(offeringId) {
  const res = await query(
    `SELECT o.id, i.user_id AS instructor_user_id, c.code AS course_code
     FROM course_offerings o
     JOIN instructors i ON i.id = o.instructor_id
     JOIN courses c ON c.id = o.course_id
     WHERE o.id = $1`,
    [offeringId]
  );
  return res.rows[0] || null;
}

export async function getEvaluationSummary(offeringId) {
  const aggRes = await query(
    `SELECT COUNT(*)::INT AS response_count,
            ROUND(AVG(rating_teaching), 2)::FLOAT AS avg_teaching,
            ROUND(AVG(rating_content), 2)::FLOAT AS avg_content,
            ROUND(AVG(rating_fairness), 2)::FLOAT AS avg_fairness
     FROM evaluation_responses
     WHERE offering_id = $1`,
    [offeringId]
  );
  const commentsRes = await query(
    `SELECT id, rating_teaching, rating_content, rating_fairness, comment, created_at
     FROM evaluation_responses
     WHERE offering_id = $1 AND comment IS NOT NULL AND comment <> ''
     ORDER BY created_at DESC`,
    [offeringId]
  );
  return {
    summary: aggRes.rows[0],
    comments: commentsRes.rows
  };
}

// --- Academic Calendar ---
export async function listCalendarEvents(termId = null) {
  const res = await query(
    `SELECT ac.id, ac.term_id, t.name AS term_name, ac.title, ac.event_type, ac.event_date
     FROM academic_calendar_events ac
     LEFT JOIN terms t ON t.id = ac.term_id
     WHERE ($1::BIGINT IS NULL OR ac.term_id = $1)
     ORDER BY ac.event_date ASC`,
    [termId]
  );
  return res.rows;
}

export async function createCalendarEvent({ termId, title, eventType, eventDate }) {
  const res = await query(
    `INSERT INTO academic_calendar_events (term_id, title, event_type, event_date)
     VALUES ($1, $2, $3, $4::DATE)
     RETURNING *`,
    [termId || null, title, eventType, eventDate]
  );
  return res.rows[0];
}

export async function deleteCalendarEvent(id) {
  const res = await query('DELETE FROM academic_calendar_events WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

// --- Executive Analytics ---
export async function getExecutiveAnalytics() {
  const [dfwRes, utilRes, loadRes, bottleRes] = await Promise.all([
    query('SELECT * FROM v_course_dfw_rates'),
    query('SELECT * FROM v_offering_utilization'),
    query('SELECT * FROM v_instructor_workload'),
    query(
      `SELECT p.code AS course_code, p.title AS course_title,
              COUNT(DISTINCT cp.course_id)::INT AS unlocks_courses,
              COALESCE(SUM(u.waitlist_count), 0)::INT AS downstream_waitlist
       FROM courses p
       JOIN course_prerequisites cp ON cp.prerequisite_id = p.id
       LEFT JOIN v_offering_utilization u ON u.course_code = p.code
       GROUP BY p.id, p.code, p.title
       ORDER BY unlocks_courses DESC, downstream_waitlist DESC`
    )
  ]);

  return {
    dfwRates: dfwRes.rows,
    roomUtilization: utilRes.rows,
    instructorWorkload: loadRes.rows,
    prereqBottlenecks: bottleRes.rows
  };
}
