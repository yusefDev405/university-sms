-- 003_functions.sql
-- Transactional enrollment stored function with row-level locking

CREATE OR REPLACE FUNCTION enroll_student(p_student_id BIGINT, p_offering_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_off course_offerings%ROWTYPE;
  v_term terms%ROWTYPE;
  v_student students%ROWTYPE;
  v_existing enrollments%ROWTYPE;
  v_taken INT;
  v_new_status TEXT;
BEGIN
  -- Lock the offering row so concurrent enrollments cannot oversell the last seat
  SELECT * INTO v_off FROM course_offerings WHERE id = p_offering_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offering not found';
  END IF;

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

  -- Check if already enrolled, waitlisted, or completed in this exact offering
  SELECT * INTO v_existing
  FROM enrollments
  WHERE student_id = p_student_id AND offering_id = p_offering_id;

  IF FOUND AND v_existing.status <> 'dropped' THEN
    -- Let the UNIQUE constraint semantics map cleanly to 23505 (already registered)
    RAISE EXCEPTION 'Already registered in this offering' USING ERRCODE = '23505';
  END IF;

  -- Cannot enroll twice in different sections of the same course in the same term
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

  -- Every prerequisite must be completed with a passing grade (D / 1.0 or higher)
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

  -- No overlapping meeting times in the same term among currently enrolled offerings
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

  IF FOUND AND v_existing.status = 'dropped' THEN
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
