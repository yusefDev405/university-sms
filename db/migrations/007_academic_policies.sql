-- 007_academic_policies.sql
-- Adds academic registration holds, in-app notifications, withdrawal ('withdrawn' / 'W') status,
-- course-repeat highest-grade GPA view, and automated waitlist/grade notification triggers.

ALTER TABLE terms
  ADD COLUMN IF NOT EXISTS withdrawal_closes TIMESTAMPTZ;

UPDATE terms
SET withdrawal_closes = COALESCE(withdrawal_closes, (end_date::TIMESTAMPTZ + interval '1 day' - interval '1 second'));

-- Update enrollments CHECK constraints safely to allow 'withdrawn' and 'W'
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'enrollments'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%status%' OR pg_get_constraintdef(oid) ILIKE '%grade_letter%')
  LOOP
    EXECUTE format('ALTER TABLE enrollments DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_status_check
    CHECK (status IN ('enrolled', 'waitlisted', 'dropped', 'withdrawn', 'completed')),
  ADD CONSTRAINT enrollments_grade_letter_check
    CHECK (grade_letter IN ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'W'));

CREATE TABLE IF NOT EXISTS academic_holds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  placed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_holds_student_active
  ON academic_holds (student_id)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Include withdrawn ('W') courses in transcript view (with NULL grade_points so GPA ignores them)
CREATE OR REPLACE VIEW v_student_transcript AS
SELECT
  e.id AS enrollment_id,
  e.student_id,
  s.student_number,
  s.first_name,
  s.last_name,
  t.id AS term_id,
  t.name AS term_name,
  t.start_date AS term_start_date,
  c.id AS course_id,
  c.code AS course_code,
  c.title AS course_title,
  c.credits,
  d.code AS department_code,
  o.section,
  e.status,
  e.grade_letter,
  e.grade_points,
  e.enrolled_at
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN course_offerings o ON o.id = e.offering_id
JOIN courses c ON c.id = o.course_id
JOIN departments d ON d.id = c.department_id
JOIN terms t ON t.id = o.term_id
WHERE (e.status = 'completed' AND e.grade_points IS NOT NULL)
   OR e.status = 'withdrawn';

-- Course repeat / grade replacement policy: keep highest grade_points per (student_id, course_id)
CREATE OR REPLACE VIEW v_student_gpa AS
WITH best_attempts AS (
  SELECT DISTINCT ON (e.student_id, o.course_id)
    e.student_id,
    e.grade_points,
    c.credits
  FROM enrollments e
  JOIN course_offerings o ON o.id = e.offering_id
  JOIN courses c ON c.id = o.course_id
  WHERE e.status = 'completed' AND e.grade_points IS NOT NULL
  ORDER BY e.student_id, o.course_id, e.grade_points DESC, e.enrolled_at DESC
)
SELECT
  student_id,
  ROUND(SUM(grade_points * credits) / NULLIF(SUM(credits), 0), 2) AS gpa,
  COALESCE(SUM(credits), 0)::INT AS credits_attempted,
  COALESCE(SUM(CASE WHEN grade_points >= 1.0 THEN credits ELSE 0 END), 0)::INT AS credits_earned
FROM best_attempts
GROUP BY student_id;

-- Upgrade enroll_student() to check active academic_holds
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

  IF EXISTS (
    SELECT 1 FROM academic_holds
    WHERE student_id = p_student_id AND resolved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Registration hold active';
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

-- Update waitlist promotion trigger to also handle withdrawals and notify the promoted student
CREATE OR REPLACE FUNCTION promote_waitlist_on_drop() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_off course_offerings%ROWTYPE;
  v_taken INT;
  v_candidate RECORD;
  v_course_code TEXT;
BEGIN
  IF OLD.status = 'enrolled' AND NEW.status IN ('dropped', 'withdrawn') THEN
    SELECT * INTO v_off FROM course_offerings WHERE id = NEW.offering_id FOR UPDATE;
    SELECT count(*)::INT INTO v_taken
    FROM enrollments
    WHERE offering_id = NEW.offering_id AND status = 'enrolled';

    IF v_taken < v_off.capacity THEN
      SELECT w.id, s.user_id INTO v_candidate
      FROM enrollments w
      JOIN students s ON s.id = w.student_id
      WHERE w.offering_id = NEW.offering_id
        AND w.status = 'waitlisted'
        AND NOT EXISTS (
          SELECT 1
          FROM offering_meetings mn
          JOIN offering_meetings mo
            ON mo.day_of_week = mn.day_of_week
           AND mo.start_time < mn.end_time
           AND mn.start_time < mo.end_time
          JOIN enrollments e2
            ON e2.offering_id = mo.offering_id
           AND e2.student_id = w.student_id
           AND e2.status = 'enrolled'
          JOIN course_offerings oo
            ON oo.id = e2.offering_id
           AND oo.term_id = v_off.term_id
          WHERE mn.offering_id = NEW.offering_id
        )
      ORDER BY w.enrolled_at ASC, w.id ASC
      LIMIT 1;

      IF v_candidate.id IS NOT NULL THEN
        UPDATE enrollments SET status = 'enrolled' WHERE id = v_candidate.id;
        SELECT code INTO v_course_code FROM courses WHERE id = v_off.course_id;
        INSERT INTO notifications (user_id, title, message)
        VALUES (
          v_candidate.user_id,
          'Waitlist Seat Assigned',
          'A seat opened in ' || v_course_code || ' (Section ' || v_off.section || ') and your enrollment is now confirmed.'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_drop ON enrollments;
CREATE TRIGGER trg_promote_waitlist_on_drop
AFTER UPDATE OF status ON enrollments
FOR EACH ROW
WHEN (OLD.status = 'enrolled' AND NEW.status IN ('dropped', 'withdrawn'))
EXECUTE FUNCTION promote_waitlist_on_drop();

-- Notify student when an instructor posts or updates a final grade
CREATE OR REPLACE FUNCTION notify_on_grade_post() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_user_id BIGINT;
  v_course_code TEXT;
BEGIN
  IF NEW.status = 'completed' AND NEW.grade_letter IS NOT NULL
     AND (OLD.grade_letter IS DISTINCT FROM NEW.grade_letter) THEN
    SELECT s.user_id INTO v_user_id FROM students s WHERE s.id = NEW.student_id;
    SELECT c.code INTO v_course_code
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    WHERE o.id = NEW.offering_id;

    INSERT INTO notifications (user_id, title, message)
    VALUES (
      v_user_id,
      'Grade Posted',
      'Final grade ' || NEW.grade_letter || ' has been posted for ' || v_course_code || '.'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_grade_post ON enrollments;
CREATE TRIGGER trg_notify_grade_post
AFTER UPDATE OF grade_letter ON enrollments
FOR EACH ROW
EXECUTE FUNCTION notify_on_grade_post();
