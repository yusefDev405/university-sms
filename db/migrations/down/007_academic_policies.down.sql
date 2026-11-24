-- 007_academic_policies.down.sql
DROP TRIGGER IF EXISTS trg_notify_grade_post ON enrollments;
DROP FUNCTION IF EXISTS notify_on_grade_post();
DROP INDEX IF EXISTS idx_notifications_user_created;
DROP TABLE IF EXISTS notifications;
DROP INDEX IF EXISTS idx_academic_holds_student_active;
DROP TABLE IF EXISTS academic_holds;
ALTER TABLE terms DROP COLUMN IF EXISTS withdrawal_closes;
