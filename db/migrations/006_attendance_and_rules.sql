-- 006_attendance_and_rules.sql
-- Adds attendance tracking tables & view, login lockout columns, course audit trigger,
-- and term credit-hour cap (18 standard / 12 on Academic Probation) inside enroll_student().

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (offering_id, session_date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_offering
  ON attendance_sessions (offering_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON attendance_records (student_id);

CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT
  o.id AS offering_id,
  c.code AS course_code,
  c.title AS course_title,
  o.section,
  t.id AS term_id,
  t.name AS term_name,
  e.student_id,
  s.student_number,
  s.first_name,
  s.last_name,
  COUNT(ar.id)::INT AS sessions_recorded,
  COUNT(ar.id) FILTER (WHERE ar.status = 'present')::INT AS present_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'late')::INT AS late_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'absent')::INT AS absent_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'excused')::INT AS excused_count,
  CASE
    WHEN COUNT(ar.id) = 0 THEN 100
    ELSE ROUND(
      (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::NUMERIC / COUNT(ar.id)::NUMERIC) * 100
    )::INT
  END AS attendance_pct
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN course_offerings o ON o.id = e.offering_id
JOIN courses c ON c.id = o.course_id
JOIN terms t ON t.id = o.term_id
LEFT JOIN attendance_sessions ats ON ats.offering_id = o.id
LEFT JOIN attendance_records ar ON ar.session_id = ats.id AND ar.student_id = e.student_id
WHERE e.status IN ('enrolled', 'completed')
GROUP BY o.id, c.id, t.id, e.student_id, s.id;

DROP TRIGGER IF EXISTS trg_audit_courses ON courses;
CREATE TRIGGER trg_audit_courses
AFTER INSERT OR UPDATE OR DELETE ON courses
FOR EACH ROW EXECUTE FUNCTION audit_row();

-- Upgrade enroll_student() to enforce term credit-hour cap (18 standard, 12 if GPA < 2.0)
CREATE OR REPLACE FUNCTION enroll_student(p_student_id BIGINT, p_offering_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_off course_offerings%ROWTYPE;
  v_course courses%ROWTYPE;
  v_term terms%ROWTYPE;
  v_student students%ROWTYPE;
  v_existing enrollments%ROWTYPE;
  v_gpa NUMERIC(3, 2);
  v_current_credits INT;
  v_max_credits INT;
  v_taken INT;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_off FROM course_offerings WHERE id = p_offering_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offering not found';
  END IF;

  SELECT * INTO v_course FROM courses WHERE id = v_off.course_id;

  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  IF v_student.status <> 'active' THEN
    RAISE EXCEPTION 'Student is not active';
  END IF;

  SELECT * INTO v_term FROM terms WHERE id = v_off.term_id;
  IF now() NOT BETWEEN v_term.registration_opens AND v_term.registration_closes THEN
    RAISE EXCEPTION 'Registration is closed';
  END IF;

  SELECT * INTO v_existing
  FROM enrollments
  WHERE student_id = p_student_id AND offering_id = p_offering_id;

  IF v_existing.id IS NOT NULL AND v_existing.status <> 'dropped' THEN
    RAISE EXCEPTION 'Already registered in this offering' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    WHERE e.student_id = p_student_id
      AND co.course_id = v_off.course_id
      AND co.term_id = v_off.term_id
      AND e.offering_id <> p_offering_id
      AND e.status IN ('enrolled', 'waitlisted')
  ) THEN
    RAISE EXCEPTION 'Already registered in another section of this course for this term' USING ERRCODE = '23505';
  END IF;

  -- Enforce term credit-hour cap based on academic standing
  SELECT gpa INTO v_gpa FROM v_student_gpa WHERE student_id = p_student_id;
  IF v_gpa IS NOT NULL AND v_gpa < 2.00 THEN
    v_max_credits := 12;
  ELSE
    v_max_credits := 18;
  END IF;

  SELECT COALESCE(SUM(c.credits), 0)::INT INTO v_current_credits
  FROM enrollments e
  JOIN course_offerings co ON co.id = e.offering_id
  JOIN courses c ON c.id = co.course_id
  WHERE e.student_id = p_student_id
    AND co.term_id = v_off.term_id
    AND e.status IN ('enrolled', 'waitlisted');

  IF (v_current_credits + v_course.credits) > v_max_credits THEN
    RAISE EXCEPTION 'Credit limit exceeded (max % credits)', v_max_credits;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM course_prerequisites cp
    WHERE cp.course_id = v_off.course_id
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        JOIN course_offerings o ON o.id = e.offering_id
        WHERE e.student_id = p_student_id
          AND o.course_id = cp.prerequisite_id
          AND e.status = 'completed'
          AND e.grade_points >= 1.0
      )
  ) THEN
    RAISE EXCEPTION 'Prerequisites not met';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM offering_meetings mn
    JOIN offering_meetings mo
      ON mo.day_of_week = mn.day_of_week
     AND mo.start_time < mn.end_time
     AND mn.start_time < mo.end_time
    JOIN enrollments e
      ON e.offering_id = mo.offering_id
     AND e.student_id = p_student_id
     AND e.status = 'enrolled'
    JOIN course_offerings oo
      ON oo.id = e.offering_id
     AND oo.term_id = v_off.term_id
    WHERE mn.offering_id = p_offering_id
  ) THEN
    RAISE EXCEPTION 'Schedule conflict';
  END IF;

  SELECT count(*)::INT INTO v_taken
  FROM enrollments
  WHERE offering_id = p_offering_id AND status = 'enrolled';

  IF v_taken >= v_off.capacity THEN
    v_new_status := 'waitlisted';
  ELSE
    v_new_status := 'enrolled';
  END IF;

  IF v_existing.id IS NOT NULL AND v_existing.status = 'dropped' THEN
    UPDATE enrollments
    SET status = v_new_status,
        enrolled_at = now(),
        grade_points = NULL,
        grade_letter = NULL
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO enrollments (student_id, offering_id, status)
    VALUES (p_student_id, p_offering_id, v_new_status);
  END IF;

  RETURN v_new_status;
END $$;
