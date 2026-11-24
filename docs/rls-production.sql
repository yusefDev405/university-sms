-- Production PostgreSQL Row-Level Security (RLS) Policy Reference
-- Enforce tenant/student isolation inside PostgreSQL when connecting with an application
-- role (non-superuser) using session-local settings (`set_config('app.user_id', ..., true)`
-- and `set_config('app.user_role', ..., true)` inside `withTransaction`).

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admins see all records; students see only their own rows.
CREATE POLICY students_isolation ON students
  USING (
    current_setting('app.user_role', true) = 'admin'
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::BIGINT
    OR (
      current_setting('app.user_role', true) = 'instructor'
      AND (
        advisor_id IN (SELECT id FROM instructors WHERE user_id = NULLIF(current_setting('app.user_id', true), '')::BIGINT)
        OR EXISTS (
          SELECT 1 FROM enrollments e
          JOIN course_offerings o ON o.id = e.offering_id
          JOIN instructors i ON i.id = o.instructor_id
          WHERE e.student_id = students.id
            AND i.user_id = NULLIF(current_setting('app.user_id', true), '')::BIGINT
        )
      )
    )
  );

CREATE POLICY enrollments_isolation ON enrollments
  USING (
    current_setting('app.user_role', true) = 'admin'
    OR student_id IN (SELECT id FROM students WHERE user_id = NULLIF(current_setting('app.user_id', true), '')::BIGINT)
    OR offering_id IN (
      SELECT o.id FROM course_offerings o
      JOIN instructors i ON i.id = o.instructor_id
      WHERE i.user_id = NULLIF(current_setting('app.user_id', true), '')::BIGINT
    )
  );

CREATE POLICY tuition_ledger_isolation ON tuition_ledger
  USING (
    current_setting('app.user_role', true) = 'admin'
    OR student_id IN (SELECT id FROM students WHERE user_id = NULLIF(current_setting('app.user_id', true), '')::BIGINT)
  );

CREATE POLICY notifications_isolation ON notifications
  USING (
    current_setting('app.user_role', true) = 'admin'
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::BIGINT
  );
