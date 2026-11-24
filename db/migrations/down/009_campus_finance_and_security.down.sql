-- 009_campus_finance_and_security.down.sql

DROP VIEW IF EXISTS v_instructor_workload;
DROP VIEW IF EXISTS v_offering_utilization;
DROP VIEW IF EXISTS v_course_dfw_rates;

DROP TRIGGER IF EXISTS trg_audit_tuition_ledger ON tuition_ledger;
DROP TABLE IF EXISTS tuition_ledger;
DROP TABLE IF EXISTS academic_calendar_events;
DROP TABLE IF EXISTS evaluation_responses;
DROP TABLE IF EXISTS evaluation_submissions;
DROP TABLE IF EXISTS office_hour_bookings;
DROP TABLE IF EXISTS office_hour_slots;
DROP TABLE IF EXISTS exam_schedules;
ALTER TABLE course_offerings DROP COLUMN IF EXISTS room_id;
DROP TABLE IF EXISTS rooms;

ALTER TABLE academic_holds DROP COLUMN IF EXISTS hold_type;
ALTER TABLE refresh_tokens
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS user_agent;
ALTER TABLE users
  DROP COLUMN IF EXISTS totp_enabled,
  DROP COLUMN IF EXISTS totp_secret;
