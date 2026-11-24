-- 006_attendance_and_rules.down.sql
DROP TRIGGER IF EXISTS trg_audit_courses ON courses;
DROP VIEW IF EXISTS v_attendance_summary;
DROP INDEX IF EXISTS idx_attendance_records_student;
DROP INDEX IF EXISTS idx_attendance_sessions_offering;
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS attendance_sessions;
ALTER TABLE users
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS failed_login_attempts;
