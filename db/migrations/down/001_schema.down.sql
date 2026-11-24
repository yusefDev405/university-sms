-- 001_schema.down.sql
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS offering_meetings;
DROP TABLE IF EXISTS course_offerings;
DROP TABLE IF EXISTS terms;
DROP TABLE IF EXISTS course_prerequisites;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS students;
DROP INDEX IF EXISTS idx_users_email_lower;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
