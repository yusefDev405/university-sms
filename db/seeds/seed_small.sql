-- seed_small.sql
-- Compact, realistic seed dataset for University Student Management System.
-- Passwords are set via db/scripts/seed.js (using bcryptjs cost 12) or fallback hashes below.
-- Default demo credentials:
--   Admin:      admin@galala.edu.eg / AdminPass123!
--   Instructor: amina.darwish@galala.edu.eg / Instructor123!
--   Student:    nadia.mansour@galala.edu.eg / Student123!

BEGIN;

-- 1. Departments (4)
INSERT INTO departments (code, name) VALUES
  ('CS', 'Computer Science'),
  ('MATH', 'Mathematics & Data Science'),
  ('ENG', 'Electrical & Computer Engineering'),
  ('BUS', 'Business Informatics');

-- 2. Users (1 admin, 3 instructors, 8 students = 12 users)
-- Placeholder bcrypt hashes are replaced cleanly by seed.js, or work directly if run via psql
INSERT INTO users (email, password_hash, role, is_active) VALUES
  ('admin@galala.edu.eg', '__ADMIN_HASH__', 'admin', true),
  ('amina.darwish@galala.edu.eg', '__INSTRUCTOR_HASH__', 'instructor', true),
  ('hisham.lotfy@galala.edu.eg', '__INSTRUCTOR_HASH__', 'instructor', true),
  ('layla.zaki@galala.edu.eg', '__INSTRUCTOR_HASH__', 'instructor', true),
  ('nadia.mansour@galala.edu.eg', '__STUDENT_HASH__', 'student', true),
  ('omar.farouk@galala.edu.eg', '__STUDENT_HASH__', 'student', true),
  ('salma.hassan@galala.edu.eg', '__STUDENT_HASH__', 'student', true),
  ('youssef.adel@galala.edu.eg', '__STUDENT_HASH__', 'student', true),
  ('mariam.nabil@galala.edu.eg', '__STUDENT_HASH__', 'student', true),
  ('karim.salah@galala.edu.eg', '__STUDENT_HASH__', 'student', true),
  ('hana.tarek@galala.edu.eg', '__STUDENT_HASH__', 'student', true),
  ('ziad.kamal@galala.edu.eg', '__STUDENT_HASH__', 'student', true);

-- 3. Instructors (3)
INSERT INTO instructors (user_id, department_id, first_name, last_name, title)
SELECT u.id, d.id, v.first_name, v.last_name, v.title
FROM (VALUES
  ('amina.darwish@galala.edu.eg', 'CS', 'Amina', 'Darwish', 'Prof.'),
  ('hisham.lotfy@galala.edu.eg', 'MATH', 'Hisham', 'Lotfy', 'Dr.'),
  ('layla.zaki@galala.edu.eg', 'ENG', 'Layla', 'Zaki', 'Dr.')
) AS v(email, dept_code, first_name, last_name, title)
JOIN users u ON lower(u.email) = lower(v.email)
JOIN departments d ON d.code = v.dept_code;

-- 4. Students (8)
INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id, status)
SELECT u.id, v.student_number, v.first_name, v.last_name, v.dob::DATE, d.id, v.status
FROM (VALUES
  ('nadia.mansour@galala.edu.eg', '2024001', 'Nadia', 'Mansour', '2005-03-14', 'CS', 'active'),
  ('omar.farouk@galala.edu.eg', '2024002', 'Omar', 'Farouk', '2005-07-22', 'CS', 'active'),
  ('salma.hassan@galala.edu.eg', '2024003', 'Salma', 'Hassan', '2004-11-05', 'CS', 'active'),
  ('youssef.adel@galala.edu.eg', '2024004', 'Youssef', 'Adel', '2005-01-19', 'MATH', 'active'),
  ('mariam.nabil@galala.edu.eg', '2024005', 'Mariam', 'Nabil', '2004-09-30', 'ENG', 'active'),
  ('karim.salah@galala.edu.eg', '2024006', 'Karim', 'Salah', '2005-06-11', 'BUS', 'active'),
  ('hana.tarek@galala.edu.eg', '2024007', 'Hana', 'Tarek', '2005-08-03', 'CS', 'active'),
  ('ziad.kamal@galala.edu.eg', '2024008', 'Ziad', 'Kamal', '2004-12-27', 'MATH', 'active')
) AS v(email, student_number, first_name, last_name, dob, dept_code, status)
JOIN users u ON lower(u.email) = lower(v.email)
JOIN departments d ON d.code = v.dept_code;

-- 5. Courses (10)
INSERT INTO courses (code, title, credits, department_id)
SELECT v.code, v.title, v.credits, d.id
FROM (VALUES
  ('CS101', 'Introduction to Programming', 3, 'CS'),
  ('CS201', 'Data Structures & Algorithms', 3, 'CS'),
  ('CS202', 'Database Systems', 3, 'CS'),
  ('CS301', 'Operating Systems', 4, 'CS'),
  ('CS305', 'Web Engineering & APIs', 3, 'CS'),
  ('MATH101', 'Calculus I', 3, 'MATH'),
  ('MATH201', 'Discrete Mathematics', 3, 'MATH'),
  ('MATH210', 'Probability & Statistics', 3, 'MATH'),
  ('ENG102', 'Digital Logic Design', 3, 'ENG'),
  ('BUS105', 'Management Information Systems', 3, 'BUS')
) AS v(code, title, credits, dept_code)
JOIN departments d ON d.code = v.dept_code;

-- 6. Prerequisites
INSERT INTO course_prerequisites (course_id, prerequisite_id)
SELECT c.id, p.id
FROM (VALUES
  ('CS201', 'CS101'),
  ('CS202', 'CS101'),
  ('CS301', 'CS201'),
  ('CS305', 'CS202'),
  ('MATH210', 'MATH101')
) AS v(course_code, prereq_code)
JOIN courses c ON c.code = v.course_code
JOIN courses p ON p.code = v.prereq_code;

-- 7. Terms (3)
-- Spring 2027 has an open registration window relative to current time so the app is always testable.
INSERT INTO terms (name, start_date, end_date, registration_opens, registration_closes) VALUES
  ('Fall 2026', '2026-09-15', '2026-12-24', '2026-08-20T08:00:00Z', '2026-09-25T23:59:59Z'),
  ('Spring 2027', '2027-02-01', '2027-05-20', now() - interval '15 days', now() + interval '45 days'),
  ('Summer 2027', '2027-06-15', '2027-08-10', now() + interval '60 days', now() + interval '90 days');

-- 8. Course Offerings (10 total: 3 historical in Fall 2026, 7 open-term in Spring 2027)
INSERT INTO course_offerings (course_id, term_id, instructor_id, section, capacity, room)
SELECT c.id, t.id, i.id, v.section, v.capacity, v.room
FROM (VALUES
  -- Fall 2026 (completed historical term)
  ('CS101', 'Fall 2026', 'amina.darwish@galala.edu.eg', '01', 30, 'Hall B-101'),
  ('MATH101', 'Fall 2026', 'hisham.lotfy@galala.edu.eg', '01', 35, 'Hall A-204'),
  ('ENG102', 'Fall 2026', 'layla.zaki@galala.edu.eg', '01', 25, 'Lab E-102'),
  -- Spring 2027 (active registration term)
  ('CS101', 'Spring 2027', 'amina.darwish@galala.edu.eg', '01', 25, 'Hall B-101'),
  ('CS201', 'Spring 2027', 'amina.darwish@galala.edu.eg', '01', 20, 'Hall B-202'),
  ('CS202', 'Spring 2027', 'amina.darwish@galala.edu.eg', '01', 2, 'Lab C-301'),
  ('CS301', 'Spring 2027', 'layla.zaki@galala.edu.eg', '01', 20, 'Hall B-305'),
  ('MATH201', 'Spring 2027', 'hisham.lotfy@galala.edu.eg', '01', 25, 'Hall A-108'),
  ('MATH210', 'Spring 2027', 'hisham.lotfy@galala.edu.eg', '01', 25, 'Hall A-110'),
  ('BUS105', 'Spring 2027', 'layla.zaki@galala.edu.eg', '01', 30, 'Hall D-105')
) AS v(course_code, term_name, instructor_email, section, capacity, room)
JOIN courses c ON c.code = v.course_code
JOIN terms t ON t.name = v.term_name
JOIN instructors i ON i.user_id = (SELECT id FROM users WHERE lower(email) = lower(v.instructor_email));

-- 9. Offering Meetings (day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu)
-- Note: MATH210 deliberately overlaps CS201 (Mon/Wed 10:00-11:30) to verify schedule conflict detection!
INSERT INTO offering_meetings (offering_id, day_of_week, start_time, end_time)
SELECT o.id, v.day_of_week, v.start_time::TIME, v.end_time::TIME
FROM (VALUES
  ('CS101', 'Spring 2027', '01', 0, '09:00', '10:30'),
  ('CS101', 'Spring 2027', '01', 2, '09:00', '10:30'),
  ('CS201', 'Spring 2027', '01', 1, '10:00', '11:30'),
  ('CS201', 'Spring 2027', '01', 3, '10:00', '11:30'),
  ('CS202', 'Spring 2027', '01', 0, '11:00', '12:30'),
  ('CS202', 'Spring 2027', '01', 2, '11:00', '12:30'),
  ('CS301', 'Spring 2027', '01', 1, '13:00', '14:30'),
  ('CS301', 'Spring 2027', '01', 3, '13:00', '14:30'),
  ('MATH201', 'Spring 2027', '01', 4, '09:00', '11:00'),
  ('MATH210', 'Spring 2027', '01', 1, '10:30', '12:00'),
  ('MATH210', 'Spring 2027', '01', 3, '10:30', '12:00'),
  ('BUS105', 'Spring 2027', '01', 4, '12:00', '14:00')
) AS v(course_code, term_name, section, day_of_week, start_time, end_time)
JOIN courses c ON c.code = v.course_code
JOIN terms t ON t.name = v.term_name
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = v.section;

-- 10. Enrollments & Historical Completed Grades
INSERT INTO enrollments (student_id, offering_id, status, grade_points, grade_letter)
SELECT s.id, o.id, v.status, v.grade_points, v.grade_letter
FROM (VALUES
  -- Fall 2026 completed courses (Nadia passed CS101 & MATH101 -> eligible for CS201, CS202, MATH210; NOT CS301!)
  ('2024001', 'CS101', 'Fall 2026', 'completed', 3.70, 'A-'),
  ('2024001', 'MATH101', 'Fall 2026', 'completed', 3.30, 'B+'),
  ('2024001', 'ENG102', 'Fall 2026', 'completed', 4.00, 'A'),
  ('2024002', 'CS101', 'Fall 2026', 'completed', 3.00, 'B'),
  ('2024002', 'MATH101', 'Fall 2026', 'completed', 2.70, 'B-'),
  ('2024003', 'CS101', 'Fall 2026', 'completed', 4.00, 'A'),
  ('2024004', 'MATH101', 'Fall 2026', 'completed', 3.70, 'A-'),
  ('2024005', 'ENG102', 'Fall 2026', 'completed', 3.30, 'B+'),
  ('2024006', 'CS101', 'Fall 2026', 'completed', 0.00, 'F'),
  -- Spring 2027 current enrollments
  ('2024001', 'CS201', 'Spring 2027', 'enrolled', NULL, NULL),
  ('2024002', 'CS201', 'Spring 2027', 'enrolled', NULL, NULL),
  -- CS202 has capacity 2: Omar & Salma fill it, so Nadia can test Waitlist!
  ('2024002', 'CS202', 'Spring 2027', 'enrolled', NULL, NULL),
  ('2024003', 'CS202', 'Spring 2027', 'enrolled', NULL, NULL),
  ('2024004', 'MATH210', 'Spring 2027', 'enrolled', NULL, NULL),
  ('2024005', 'CS101', 'Spring 2027', 'enrolled', NULL, NULL),
  ('2024006', 'BUS105', 'Spring 2027', 'enrolled', NULL, NULL),
  ('2024007', 'CS101', 'Spring 2027', 'enrolled', NULL, NULL),
  ('2024008', 'MATH201', 'Spring 2027', 'enrolled', NULL, NULL)
) AS v(student_number, course_code, term_name, status, grade_points, grade_letter)
JOIN students s ON s.student_number = v.student_number
JOIN courses c ON c.code = v.course_code
JOIN terms t ON t.name = v.term_name
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01';

-- 11. Sample Attendance Sessions & Records for CS201 (Spring 2027)
INSERT INTO attendance_sessions (offering_id, session_date, topic, created_by)
SELECT o.id, v.session_date::DATE, v.topic, u.id
FROM (VALUES
  ('2027-02-08', 'Asymptotic Complexity & Recurrences'),
  ('2027-02-10', 'Linked Lists, Stacks & Queues')
) AS v(session_date, topic)
JOIN courses c ON c.code = 'CS201'
JOIN terms t ON t.name = 'Spring 2027'
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01'
JOIN users u ON lower(u.email) = 'amina.darwish@galala.edu.eg';

INSERT INTO attendance_records (session_id, student_id, status)
SELECT ats.id, s.id, v.status
FROM (VALUES
  ('2027-02-08', '2024001', 'present'),
  ('2027-02-08', '2024002', 'present'),
  ('2027-02-10', '2024001', 'present'),
  ('2027-02-10', '2024002', 'late')
) AS v(session_date, student_number, status)
JOIN attendance_sessions ats ON ats.session_date = v.session_date::DATE
JOIN students s ON s.student_number = v.student_number;

COMMIT;
