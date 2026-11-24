-- 004_triggers.down.sql
DROP TRIGGER IF EXISTS trg_promote_waitlist_on_drop ON enrollments;
DROP FUNCTION IF EXISTS promote_waitlist_on_drop();
DROP TRIGGER IF EXISTS trg_audit_terms ON terms;
DROP TRIGGER IF EXISTS trg_audit_enrollments ON enrollments;
DROP FUNCTION IF EXISTS audit_row();
