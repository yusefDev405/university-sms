-- 002_views.sql
-- Analytical and operational PostgreSQL views

CREATE OR REPLACE VIEW v_student_transcript AS
SELECT
  e.id AS enrollment_id,
  e.student_id,
  s.student_number,
  s.first_name,
  s.last_name,
  t.id AS term_id,
  t.name AS term_name,
  t.start_date AS term_start_date,
  c.id AS course_id,
  c.code AS course_code,
  c.title AS course_title,
  c.credits,
  d.code AS department_code,
  o.section,
  e.status,
  e.grade_letter,
  e.grade_points,
  e.enrolled_at
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN course_offerings o ON o.id = e.offering_id
JOIN courses c ON c.id = o.course_id
JOIN departments d ON d.id = c.department_id
JOIN terms t ON t.id = o.term_id
WHERE e.status = 'completed' AND e.grade_points IS NOT NULL;

CREATE OR REPLACE VIEW v_student_gpa AS
SELECT
  e.student_id,
  ROUND(SUM(e.grade_points * c.credits) / NULLIF(SUM(c.credits), 0), 2) AS gpa,
  COALESCE(SUM(c.credits), 0)::INT AS credits_attempted,
  COALESCE(SUM(CASE WHEN e.grade_points >= 1.0 THEN c.credits ELSE 0 END), 0)::INT AS credits_earned
FROM enrollments e
JOIN course_offerings o ON o.id = e.offering_id
JOIN courses c ON c.id = o.course_id
WHERE e.status = 'completed' AND e.grade_points IS NOT NULL
GROUP BY e.student_id;

CREATE OR REPLACE VIEW v_offering_availability AS
SELECT
  o.id AS offering_id,
  o.course_id,
  c.code AS course_code,
  c.title AS course_title,
  c.credits,
  c.department_id,
  d.code AS department_code,
  d.name AS department_name,
  o.term_id,
  t.name AS term_name,
  t.registration_opens,
  t.registration_closes,
  o.instructor_id,
  i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name,
  o.section,
  o.capacity,
  o.room,
  COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'enrolled'), 0)::INT AS enrolled_count,
  COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'waitlisted'), 0)::INT AS waitlist_count,
  GREATEST(o.capacity - COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'enrolled'), 0), 0)::INT AS seats_left
FROM course_offerings o
JOIN courses c ON c.id = o.course_id
JOIN departments d ON d.id = c.department_id
JOIN terms t ON t.id = o.term_id
JOIN instructors i ON i.id = o.instructor_id
LEFT JOIN enrollments e ON e.offering_id = o.id
GROUP BY
  o.id, c.id, d.id, t.id, i.id;

CREATE OR REPLACE VIEW v_instructor_roster AS
SELECT
  e.id AS enrollment_id,
  e.offering_id,
  o.instructor_id,
  o.term_id,
  t.name AS term_name,
  c.code AS course_code,
  c.title AS course_title,
  o.section,
  s.id AS student_id,
  s.student_number,
  s.first_name,
  s.last_name,
  u.email,
  d.code AS department_code,
  e.status,
  e.grade_letter,
  e.grade_points,
  e.enrolled_at
FROM enrollments e
JOIN course_offerings o ON o.id = e.offering_id
JOIN courses c ON c.id = o.course_id
JOIN terms t ON t.id = o.term_id
JOIN students s ON s.id = e.student_id
JOIN users u ON u.id = s.user_id
JOIN departments d ON d.id = s.department_id
WHERE e.status IN ('enrolled', 'waitlisted', 'completed');
