-- 009_campus_finance_and_security.sql
-- Phase C, D & E: Rooms, Final Exam Schedules, Instructor Office Hours & Bookings,
-- Strictly Anonymous Course Evaluations, Academic Calendar, Tuition & Scholarship Ledger,
-- Executive Analytics Views (DFW rates, Room Utilization, Faculty Workload), and 2FA/Session metadata.

-- 1. Extend security & hold columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE academic_holds
  ADD COLUMN IF NOT EXISTS hold_type TEXT NOT NULL DEFAULT 'academic'
    CHECK (hold_type IN ('academic', 'financial', 'disciplinary', 'administrative'));

-- 2. Campus Rooms & optional FK on course_offerings
CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building TEXT NOT NULL,
  room_number TEXT NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  room_type TEXT NOT NULL DEFAULT 'lecture' CHECK (room_type IN ('lecture', 'lab', 'seminar', 'auditorium')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building, room_number)
);

ALTER TABLE course_offerings
  ADD COLUMN IF NOT EXISTS room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL;

-- 3. Final Exam Schedules
CREATE TABLE IF NOT EXISTS exam_schedules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offering_id BIGINT NOT NULL UNIQUE REFERENCES course_offerings(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_date_room ON exam_schedules (exam_date, room);

-- 4. Instructor Office Hours & Bookings
CREATE TABLE IF NOT EXISTS office_hour_slots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instructor_id BIGINT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL,
  CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS office_hour_bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slot_id BIGINT NOT NULL REFERENCES office_hour_slots(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_office_hour_unique_booked
  ON office_hour_bookings (slot_id, booking_date)
  WHERE status = 'booked';

-- 5. Anonymous Course Evaluations (submission identity separated from response content)
CREATE TABLE IF NOT EXISTS evaluation_submissions (
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (offering_id, student_id)
);

CREATE TABLE IF NOT EXISTS evaluation_responses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  rating_teaching SMALLINT NOT NULL CHECK (rating_teaching BETWEEN 1 AND 5),
  rating_content SMALLINT NOT NULL CHECK (rating_content BETWEEN 1 AND 5),
  rating_fairness SMALLINT NOT NULL CHECK (rating_fairness BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_responses_offering ON evaluation_responses (offering_id);

-- 6. Academic Calendar Milestones
CREATE TABLE IF NOT EXISTS academic_calendar_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id BIGINT REFERENCES terms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('registration', 'add_drop', 'withdrawal', 'exams', 'holiday', 'commencement')),
  event_date DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_date ON academic_calendar_events (event_date ASC);

-- 7. Append-Only Student Tuition & Scholarship Ledger
CREATE TABLE IF NOT EXISTS tuition_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  term_id BIGINT REFERENCES terms(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('tuition_charge', 'fee', 'scholarship_waiver', 'payment')),
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tuition_ledger_student ON tuition_ledger (student_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_audit_tuition_ledger ON tuition_ledger;
CREATE TRIGGER trg_audit_tuition_ledger
AFTER INSERT OR UPDATE OR DELETE ON tuition_ledger
FOR EACH ROW EXECUTE FUNCTION audit_row();

-- 8. Executive Analytics Views
CREATE OR REPLACE VIEW v_course_dfw_rates AS
SELECT
  c.id AS course_id,
  c.code AS course_code,
  c.title AS course_title,
  d.code AS department_code,
  COUNT(e.id)::INT AS total_graded,
  COUNT(e.id) FILTER (
    WHERE e.grade_letter IN ('D+', 'D', 'F', 'W', 'NP')
  )::INT AS dfw_count,
  COALESCE(
    ROUND(
      (COUNT(e.id) FILTER (WHERE e.grade_letter IN ('D+', 'D', 'F', 'W', 'NP'))::NUMERIC
       / NULLIF(COUNT(e.id), 0)::NUMERIC) * 100,
      1
    ),
    0.0
  ) AS dfw_rate_pct,
  ROUND(AVG(e.grade_points), 2) AS avg_grade_points
FROM courses c
JOIN departments d ON d.id = c.department_id
LEFT JOIN course_offerings o ON o.course_id = c.id
LEFT JOIN enrollments e ON e.offering_id = o.id
  AND (e.status = 'withdrawn' OR (e.status = 'completed' AND e.grade_letter IS NOT NULL))
GROUP BY c.id, d.code
ORDER BY dfw_rate_pct DESC, c.code ASC;

CREATE OR REPLACE VIEW v_offering_utilization AS
SELECT
  o.id AS offering_id,
  c.code AS course_code,
  c.title AS course_title,
  t.id AS term_id,
  t.name AS term_name,
  o.section,
  o.room,
  o.capacity,
  COUNT(e.id) FILTER (WHERE e.status = 'enrolled')::INT AS enrolled_count,
  COUNT(e.id) FILTER (WHERE e.status = 'waitlisted')::INT AS waitlist_count,
  COALESCE(
    ROUND((COUNT(e.id) FILTER (WHERE e.status = 'enrolled')::NUMERIC / NULLIF(o.capacity, 0)::NUMERIC) * 100, 1),
    0.0
  ) AS utilization_pct
FROM course_offerings o
JOIN courses c ON c.id = o.course_id
JOIN terms t ON t.id = o.term_id
LEFT JOIN enrollments e ON e.offering_id = o.id
GROUP BY o.id, c.code, c.title, t.id, t.name
ORDER BY t.start_date DESC, utilization_pct DESC;

CREATE OR REPLACE VIEW v_instructor_workload AS
SELECT
  i.id AS instructor_id,
  i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name,
  d.code AS department_code,
  i.is_chair,
  i.max_credit_load,
  t.id AS term_id,
  t.name AS term_name,
  COUNT(DISTINCT o.id)::INT AS offering_count,
  COALESCE(SUM(c.credits), 0)::INT AS assigned_credits,
  (
    SELECT COUNT(*)::INT
    FROM enrollments e2
    JOIN course_offerings o2 ON o2.id = e2.offering_id
    WHERE o2.instructor_id = i.id AND o2.term_id = t.id AND e2.status = 'enrolled'
  ) AS total_enrolled,
  (COALESCE(SUM(c.credits), 0) > i.max_credit_load) AS is_overloaded
FROM instructors i
JOIN departments d ON d.id = i.department_id
CROSS JOIN terms t
LEFT JOIN course_offerings o ON o.instructor_id = i.id AND o.term_id = t.id
LEFT JOIN courses c ON c.id = o.course_id
GROUP BY i.id, d.code, t.id, t.name
ORDER BY t.start_date DESC, assigned_credits DESC;
