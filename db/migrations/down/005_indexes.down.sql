-- 005_indexes.down.sql
DROP INDEX IF EXISTS idx_refresh_tokens_family;
DROP INDEX IF EXISTS idx_audit_log_entity_created;
DROP INDEX IF EXISTS idx_courses_department;
DROP INDEX IF EXISTS idx_course_offerings_term_course;
DROP INDEX IF EXISTS idx_enrollments_offering_enrolled;
DROP INDEX IF EXISTS idx_enrollments_student_status;
