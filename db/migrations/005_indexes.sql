-- 005_indexes.sql
-- Query optimization indexes

CREATE INDEX IF NOT EXISTS idx_enrollments_student_status
  ON enrollments (student_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_offering_enrolled
  ON enrollments (offering_id)
  WHERE status = 'enrolled';

CREATE INDEX IF NOT EXISTS idx_course_offerings_term_course
  ON course_offerings (term_id, course_id);

CREATE INDEX IF NOT EXISTS idx_courses_department
  ON courses (department_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_created
  ON audit_log (entity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
  ON refresh_tokens (family_id);
