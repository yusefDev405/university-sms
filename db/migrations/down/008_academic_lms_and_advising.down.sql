-- 008_academic_lms_and_advising.down.sql

DROP TRIGGER IF EXISTS trg_audit_graduation_applications ON graduation_applications;
DROP TRIGGER IF EXISTS trg_audit_admissions_applications ON admissions_applications;
DROP TRIGGER IF EXISTS trg_audit_override_petitions ON override_petitions;
DROP TRIGGER IF EXISTS trg_audit_grade_appeals ON grade_appeals;

DROP TABLE IF EXISTS graduation_applications;
DROP TABLE IF EXISTS transfer_credits;
DROP TABLE IF EXISTS admissions_applications;
DROP TABLE IF EXISTS degree_plan_items;
DROP TABLE IF EXISTS early_alerts;
DROP TABLE IF EXISTS override_petitions;
DROP TABLE IF EXISTS grade_appeals;
DROP TABLE IF EXISTS course_announcements;
DROP TABLE IF EXISTS assessment_scores;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS course_equivalencies;
DROP TABLE IF EXISTS course_corequisites;

ALTER TABLE course_offerings DROP COLUMN IF EXISTS syllabus_summary;
ALTER TABLE students
  DROP COLUMN IF EXISTS emergency_contact,
  DROP COLUMN IF EXISTS major_concentration,
  DROP COLUMN IF EXISTS advisor_id;
ALTER TABLE instructors
  DROP COLUMN IF EXISTS max_credit_load,
  DROP COLUMN IF EXISTS is_chair;
