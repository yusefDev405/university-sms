-- 004_triggers.sql
-- Generic audit trigger and waitlist auto-promotion trigger

CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, old_data, new_data)
  VALUES (
    NULLIF(current_setting('app.user_id', true), '')::BIGINT,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_enrollments ON enrollments;
CREATE TRIGGER trg_audit_enrollments
AFTER INSERT OR UPDATE OR DELETE ON enrollments
FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS trg_audit_terms ON terms;
CREATE TRIGGER trg_audit_terms
AFTER INSERT OR UPDATE OR DELETE ON terms
FOR EACH ROW EXECUTE FUNCTION audit_row();

-- Stretch feature: auto-promote oldest waitlisted student when an enrolled student drops
CREATE OR REPLACE FUNCTION promote_waitlist_on_drop() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_off course_offerings%ROWTYPE;
  v_taken INT;
  v_candidate_id BIGINT;
BEGIN
  IF OLD.status = 'enrolled' AND NEW.status = 'dropped' THEN
    SELECT * INTO v_off FROM course_offerings WHERE id = NEW.offering_id FOR UPDATE;
    SELECT count(*)::INT INTO v_taken
    FROM enrollments
    WHERE offering_id = NEW.offering_id AND status = 'enrolled';

    IF v_taken < v_off.capacity THEN
      -- Pick oldest waitlisted candidate who has no schedule conflict
      SELECT w.id INTO v_candidate_id
      FROM enrollments w
      WHERE w.offering_id = NEW.offering_id
        AND w.status = 'waitlisted'
        AND NOT EXISTS (
          SELECT 1
          FROM offering_meetings mn
          JOIN offering_meetings mo
            ON mo.day_of_week = mn.day_of_week
           AND mo.start_time < mn.end_time
           AND mn.start_time < mo.end_time
          JOIN enrollments e2
            ON e2.offering_id = mo.offering_id
           AND e2.student_id = w.student_id
           AND e2.status = 'enrolled'
          JOIN course_offerings oo
            ON oo.id = e2.offering_id
           AND oo.term_id = v_off.term_id
          WHERE mn.offering_id = NEW.offering_id
        )
      ORDER BY w.enrolled_at ASC, w.id ASC
      LIMIT 1;

      IF v_candidate_id IS NOT NULL THEN
        UPDATE enrollments
        SET status = 'enrolled'
        WHERE id = v_candidate_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_drop ON enrollments;
CREATE TRIGGER trg_promote_waitlist_on_drop
AFTER UPDATE OF status ON enrollments
FOR EACH ROW
WHEN (OLD.status = 'enrolled' AND NEW.status = 'dropped')
EXECUTE FUNCTION promote_waitlist_on_drop();
