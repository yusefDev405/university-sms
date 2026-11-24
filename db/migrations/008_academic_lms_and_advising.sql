-- 008_academic_lms_and_advising.sql
-- Phase A & B: Corequisites, course equivalencies, weighted gradebook assessments,
-- course announcements, grade appeals, override petitions, advising & early alerts,
-- multi-term degree planner, admissions applications, transfer credits, graduation verification.

-- 1. Extend faculty, student, offering, and enrollment columns
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS is_chair BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_credit_load INT NOT NULL DEFAULT 12 CHECK (max_credit_load BETWEEN 3 AND 24);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS advisor_id BIGINT REFERENCES instructors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS major_concentration TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

ALTER TABLE course_offerings
  ADD COLUMN IF NOT EXISTS syllabus_summary TEXT;

DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'enrollments'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%grade_letter%'
  LOOP
    EXECUTE format('ALTER TABLE enrollments DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_grade_letter_check
    CHECK (grade_letter IN ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'W', 'I', 'P', 'NP'));

-- 2. Course corequisites & equivalencies
CREATE TABLE IF NOT EXISTS course_corequisites (
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  corequisite_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, corequisite_id),
  CHECK (course_id <> corequisite_id)
);

CREATE TABLE IF NOT EXISTS course_equivalencies (
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  equivalent_course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, equivalent_course_id),
  CHECK (course_id <> equivalent_course_id)
);

-- 3. Weighted LMS-bridge gradebook & announcements
CREATE TABLE IF NOT EXISTS assessments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('assignment', 'quiz', 'midterm', 'project', 'final', 'participation')),
  weight_pct NUMERIC(5, 2) NOT NULL CHECK (weight_pct > 0 AND weight_pct <= 100),
  max_score NUMERIC(6, 2) NOT NULL CHECK (max_score > 0),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_offering ON assessments (offering_id, id);

CREATE TABLE IF NOT EXISTS assessment_scores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score NUMERIC(6, 2) NOT NULL CHECK (score >= 0),
  feedback TEXT,
  graded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_scores_student ON assessment_scores (student_id);

CREATE TABLE IF NOT EXISTS course_announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  author_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_announcements_offering ON course_announcements (offering_id, created_at DESC);

-- 4. Grade appeals & registration override petitions
CREATE TABLE IF NOT EXISTS grade_appeals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id BIGINT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  original_grade TEXT NOT NULL,
  requested_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  revised_grade TEXT CHECK (revised_grade IS NULL OR revised_grade IN ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'I', 'P', 'NP')),
  decision_note TEXT,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grade_appeals_student ON grade_appeals (student_id, status);

CREATE TABLE IF NOT EXISTS override_petitions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  petition_type TEXT NOT NULL CHECK (petition_type IN ('prerequisite', 'credit_overload', 'capacity')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_override_petitions_student ON override_petitions (student_id, offering_id, status);

-- 5. Early alerts & multi-term degree planner
CREATE TABLE IF NOT EXISTS early_alerts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  offering_id BIGINT REFERENCES course_offerings(id) ON DELETE SET NULL,
  instructor_id BIGINT NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('attendance', 'academic_risk', 'missing_work', 'commendation')),
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_early_alerts_student ON early_alerts (student_id, status);

CREATE TABLE IF NOT EXISTS degree_plan_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_label TEXT NOT NULL,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

-- 6. Admissions, transfer credits, and graduation verification
CREATE TABLE IF NOT EXISTS admissions_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  entry_score NUMERIC(5, 2) NOT NULL CHECK (entry_score BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'admitted', 'rejected', 'matriculated')),
  decision_note TEXT,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  matriculated_student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfer_credits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  external_course_code TEXT NOT NULL,
  equivalent_course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
  credits INT NOT NULL CHECK (credits BETWEEN 1 AND 6),
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_credits_student ON transfer_credits (student_id, equivalent_course_id);

CREATE TABLE IF NOT EXISTS graduation_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  target_term TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'conferred', 'denied')),
  verification_code TEXT NOT NULL UNIQUE,
  credits_verified INT NOT NULL DEFAULT 0,
  gpa_verified NUMERIC(3, 2),
  decision_note TEXT,
  decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

-- 7. Update v_student_transcript to show I/P/NP and W alongside standard letter grades
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
WHERE e.status IN ('completed', 'withdrawn')
  AND (e.grade_letter IS NOT NULL OR e.grade_points IS NOT NULL);

-- 8. Upgrade enroll_student() with approved override petitions, course equivalencies, transfer credits, P grades, and corequisites
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
  v_has_prereq_override BOOLEAN;
  v_has_overload_override BOOLEAN;
  v_has_capacity_override BOOLEAN;
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

  SELECT
    EXISTS (SELECT 1 FROM override_petitions WHERE student_id = p_student_id AND offering_id = p_offering_id AND petition_type = 'prerequisite' AND status = 'approved'),
    EXISTS (SELECT 1 FROM override_petitions WHERE student_id = p_student_id AND offering_id = p_offering_id AND petition_type = 'credit_overload' AND status = 'approved'),
    EXISTS (SELECT 1 FROM override_petitions WHERE student_id = p_student_id AND offering_id = p_offering_id AND petition_type = 'capacity' AND status = 'approved')
  INTO v_has_prereq_override, v_has_overload_override, v_has_capacity_override;

  SELECT gpa INTO v_gpa FROM v_student_gpa WHERE student_id = p_student_id;
  IF v_gpa IS NOT NULL AND v_gpa < 2.00 THEN
    v_max_credits := 12;
  ELSE
    v_max_credits := 18;
  END IF;
  IF v_has_overload_override THEN
    v_max_credits := v_max_credits + 6;
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

  IF NOT v_has_prereq_override AND EXISTS (
    SELECT 1
    FROM course_prerequisites cp
    WHERE cp.course_id = v_off.course_id
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        JOIN course_offerings o ON o.id = e.offering_id
        WHERE e.student_id = p_student_id
          AND (
            o.course_id = cp.prerequisite_id
            OR EXISTS (
              SELECT 1 FROM course_equivalencies ce
              WHERE (ce.course_id = cp.prerequisite_id AND ce.equivalent_course_id = o.course_id)
                 OR (ce.equivalent_course_id = cp.prerequisite_id AND ce.course_id = o.course_id)
            )
          )
          AND e.status = 'completed'
          AND (e.grade_points >= 1.0 OR e.grade_letter = 'P')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM transfer_credits tc
        WHERE tc.student_id = p_student_id
          AND (
            tc.equivalent_course_id = cp.prerequisite_id
            OR EXISTS (
              SELECT 1 FROM course_equivalencies ce
              WHERE (ce.course_id = cp.prerequisite_id AND ce.equivalent_course_id = tc.equivalent_course_id)
                 OR (ce.equivalent_course_id = cp.prerequisite_id AND ce.course_id = tc.equivalent_course_id)
            )
          )
      )
  ) THEN
    RAISE EXCEPTION 'Prerequisites not met';
  END IF;

  IF NOT v_has_prereq_override AND EXISTS (
    SELECT 1
    FROM course_corequisites cc
    WHERE cc.course_id = v_off.course_id
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        JOIN course_offerings o ON o.id = e.offering_id
        WHERE e.student_id = p_student_id
          AND o.course_id = cc.corequisite_id
          AND (
            (e.status = 'completed' AND (e.grade_points >= 1.0 OR e.grade_letter = 'P'))
            OR (e.status = 'enrolled' AND o.term_id = v_off.term_id)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM transfer_credits tc
        WHERE tc.student_id = p_student_id AND tc.equivalent_course_id = cc.corequisite_id
      )
  ) THEN
    RAISE EXCEPTION 'Corequisites not met';
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

  IF v_taken >= v_off.capacity AND NOT v_has_capacity_override THEN
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

-- 9. Audit triggers on new governance workflows
DROP TRIGGER IF EXISTS trg_audit_grade_appeals ON grade_appeals;
CREATE TRIGGER trg_audit_grade_appeals
AFTER INSERT OR UPDATE OR DELETE ON grade_appeals
FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS trg_audit_override_petitions ON override_petitions;
CREATE TRIGGER trg_audit_override_petitions
AFTER INSERT OR UPDATE OR DELETE ON override_petitions
FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS trg_audit_admissions_applications ON admissions_applications;
CREATE TRIGGER trg_audit_admissions_applications
AFTER INSERT OR UPDATE OR DELETE ON admissions_applications
FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS trg_audit_graduation_applications ON graduation_applications;
CREATE TRIGGER trg_audit_graduation_applications
AFTER INSERT OR UPDATE OR DELETE ON graduation_applications
FOR EACH ROW EXECUTE FUNCTION audit_row();
