-- explain_demo.sql
-- Standalone SQL version for external PostgreSQL instances (run via psql)

EXPLAIN (ANALYZE, BUFFERS)
SELECT e.id, c.code, c.title, t.name AS term_name, e.grade_letter, e.grade_points
FROM enrollments e
JOIN course_offerings o ON o.id = e.offering_id
JOIN courses c ON c.id = o.course_id
JOIN terms t ON t.id = o.term_id
WHERE e.student_id = 42 AND e.status = 'completed';

-- Apply composite index if not present:
-- CREATE INDEX idx_enrollments_student_status ON enrollments (student_id, status);
-- VACUUM ANALYZE enrollments;
