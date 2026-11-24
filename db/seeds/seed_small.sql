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

-- 12. Sample Notification & Historical Resolved Hold
INSERT INTO notifications (user_id, title, message)
SELECT id, 'Spring 2027 Registration Open', 'Course registration for Spring 2027 is open. Check prerequisites and meeting times before enrolling.'
FROM users WHERE lower(email) = 'nadia.mansour@galala.edu.eg';

INSERT INTO academic_holds (student_id, reason, placed_by, resolved_at, resolved_by)
SELECT s.id, 'Library clearance verified', a.id, now() - interval '5 days', a.id
FROM students s, users a
WHERE s.student_number = '2024006' AND lower(a.email) = 'admin@galala.edu.eg';

-- 13. Faculty chair, advisors, concentrations, and offering syllabi (Phases A-B)
UPDATE instructors SET is_chair = true, max_credit_load = 12
WHERE user_id = (SELECT id FROM users WHERE lower(email) = 'amina.darwish@galala.edu.eg');

UPDATE students SET
  advisor_id = (SELECT i.id FROM instructors i JOIN users u ON u.id = i.user_id WHERE lower(u.email) = 'amina.darwish@galala.edu.eg'),
  major_concentration = 'Artificial Intelligence & Systems'
WHERE student_number IN ('2024001', '2024002', '2024003');

UPDATE students SET
  advisor_id = (SELECT i.id FROM instructors i JOIN users u ON u.id = i.user_id WHERE lower(u.email) = 'hisham.lotfy@galala.edu.eg'),
  major_concentration = 'Applied Data Science'
WHERE student_number IN ('2024004', '2024008');

UPDATE students SET
  advisor_id = (SELECT i.id FROM instructors i JOIN users u ON u.id = i.user_id WHERE lower(u.email) = 'layla.zaki@galala.edu.eg')
WHERE student_number IN ('2024005', '2024006');

UPDATE course_offerings o
SET syllabus_summary = 'Algorithm analysis, recurrence relations, balanced search trees, heaps, graph traversal, and dynamic programming.'
FROM courses c, terms t
WHERE o.course_id = c.id AND o.term_id = t.id AND c.code = 'CS201' AND t.name = 'Spring 2027';

UPDATE course_offerings o
SET syllabus_summary = 'Relational algebra, SQL normalization (3NF/BCNF), indexing, concurrency control, and crash recovery.'
FROM courses c, terms t
WHERE o.course_id = c.id AND o.term_id = t.id AND c.code = 'CS202' AND t.name = 'Spring 2027';

-- 14. Campus rooms inventory and link to offerings
INSERT INTO rooms (building, room_number, capacity, room_type) VALUES
  ('Building B', 'Hall B-101', 35, 'lecture'),
  ('Building B', 'Hall B-202', 25, 'lecture'),
  ('Building C', 'Lab C-301', 20, 'lab'),
  ('Building A', 'Hall A-108', 30, 'lecture'),
  ('Building D', 'Hall D-105', 35, 'lecture');

UPDATE course_offerings o
SET room_id = r.id
FROM rooms r
WHERE o.room = r.room_number;

-- 15. Weighted Gradebook Assessments & Sample Scores for CS201 (Spring 2027)
INSERT INTO assessments (offering_id, title, category, weight_pct, max_score, due_date)
SELECT o.id, v.title, v.category, v.weight_pct, v.max_score, v.due_date::DATE
FROM (VALUES
  ('Assignment 1: Asymptotic Analysis', 'assignment', 20.00, 100.00, '2027-02-20'),
  ('Midterm Examination', 'midterm', 30.00, 100.00, '2027-03-25'),
  ('Comprehensive Final Exam', 'final', 50.00, 100.00, '2027-05-12')
) AS v(title, category, weight_pct, max_score, due_date)
JOIN courses c ON c.code = 'CS201'
JOIN terms t ON t.name = 'Spring 2027'
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01';

INSERT INTO assessment_scores (assessment_id, student_id, score, feedback, graded_by)
SELECT a.id, s.id, v.score, v.feedback, u.id
FROM (VALUES
  ('Assignment 1: Asymptotic Analysis', '2024001', 96.00, 'Clean recurrence proofs.'),
  ('Midterm Examination', '2024001', 92.00, 'Strong graph traversal solution.'),
  ('Assignment 1: Asymptotic Analysis', '2024002', 85.00, 'Good Big-O analysis.'),
  ('Midterm Examination', '2024002', 84.00, 'Solid work; review Master Theorem case 2.')
) AS v(title, student_number, score, feedback)
JOIN assessments a ON a.title = v.title
JOIN students s ON s.student_number = v.student_number
JOIN users u ON lower(u.email) = 'amina.darwish@galala.edu.eg';

-- 16. Course Announcements
INSERT INTO course_announcements (offering_id, author_user_id, title, body)
SELECT o.id, u.id, v.title, v.body
FROM (VALUES
  ('CS201', 'Welcome to Data Structures (Spring 2027)', 'Weekly problem sets open Sunday mornings. Office hours are held in Hall B-210.'),
  ('CS202', 'PostgreSQL Lab Environment Ready', 'Ensure your team schema normalization exercise is submitted prior to Week 4 lab.')
) AS v(course_code, title, body)
JOIN courses c ON c.code = v.course_code
JOIN terms t ON t.name = 'Spring 2027'
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01'
JOIN users u ON lower(u.email) = 'amina.darwish@galala.edu.eg';

-- 17. Transfer Credits, Advising Early Alerts & Multi-Term Planner
INSERT INTO transfer_credits (student_id, institution_name, external_course_code, equivalent_course_id, credits, approved_by)
SELECT s.id, 'Cairo University', 'MTH111', c.id, 3, u.id
FROM students s, courses c, users u
WHERE s.student_number = '2024003' AND c.code = 'MATH101' AND lower(u.email) = 'admin@galala.edu.eg';

INSERT INTO early_alerts (student_id, offering_id, instructor_id, flag_type, note, status)
SELECT s.id, o.id, i.id, 'commendation', 'Top 5% performance on midterm algorithms section.', 'open'
FROM students s
JOIN courses c ON c.code = 'CS201'
JOIN terms t ON t.name = 'Spring 2027'
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01'
JOIN instructors i ON i.user_id = (SELECT id FROM users WHERE lower(email) = 'amina.darwish@galala.edu.eg')
WHERE s.student_number = '2024001';

INSERT INTO early_alerts (student_id, offering_id, instructor_id, flag_type, note, status)
SELECT s.id, o.id, i.id, 'academic_risk', 'Please schedule an advising meeting regarding prerequisite retake plan.', 'open'
FROM students s
JOIN courses c ON c.code = 'BUS105'
JOIN terms t ON t.name = 'Spring 2027'
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01'
JOIN instructors i ON i.user_id = (SELECT id FROM users WHERE lower(email) = 'layla.zaki@galala.edu.eg')
WHERE s.student_number = '2024006';

INSERT INTO degree_plan_items (student_id, term_label, course_id, notes)
SELECT s.id, 'Fall 2027', c.id, 'Target core major requirement'
FROM students s, courses c
WHERE s.student_number = '2024001' AND c.code IN ('CS301', 'CS305');

-- 18. Admissions Applications & Conferred Graduation Verification Record
INSERT INTO admissions_applications (email, first_name, last_name, date_of_birth, department_id, entry_score, status, decision_note)
SELECT v.email, v.first_name, v.last_name, v.dob::DATE, d.id, v.score, v.status, v.note
FROM (VALUES
  ('tamer.hany@applicant.edu.eg', 'Tamer', 'Hany', '2007-04-12', 'CS', 93.50, 'admitted', 'Meets STEM honours admissions threshold.'),
  ('nour.essam@applicant.edu.eg', 'Nour', 'Essam', '2007-09-18', 'MATH', 88.00, 'submitted', 'Awaiting registrar review.')
) AS v(email, first_name, last_name, dob, dept_code, score, status, note)
JOIN departments d ON d.code = v.dept_code;

INSERT INTO graduation_applications (student_id, target_term, status, verification_code, credits_verified, gpa_verified, decision_note, decided_by, decided_at)
SELECT s.id, 'Spring 2027', 'conferred', 'GAL-2027-CS-2024003', 132, 3.85, 'B.Sc. Computer Science degree conferred with Honours.', a.id, now() - interval '2 days'
FROM students s, users a
WHERE s.student_number = '2024003' AND lower(a.email) = 'admin@galala.edu.eg';

-- 19. Final Exam Schedules, Office Hours, Anonymous Evaluations, Academic Calendar & Tuition Ledger
INSERT INTO exam_schedules (offering_id, exam_date, start_time, end_time, room)
SELECT o.id, v.exam_date::DATE, v.start_time::TIME, v.end_time::TIME, o.room
FROM (VALUES
  ('CS201', '2027-05-12', '09:00', '11:00'),
  ('CS202', '2027-05-14', '09:00', '11:00'),
  ('MATH201', '2027-05-16', '12:00', '14:00')
) AS v(course_code, exam_date, start_time, end_time)
JOIN courses c ON c.code = v.course_code
JOIN terms t ON t.name = 'Spring 2027'
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01';

INSERT INTO office_hour_slots (instructor_id, day_of_week, start_time, end_time, location)
SELECT i.id, v.dow, v.start_time::TIME, v.end_time::TIME, v.location
FROM (VALUES
  ('amina.darwish@galala.edu.eg', 0, '12:30', '14:00', 'Faculty Wing B-210'),
  ('hisham.lotfy@galala.edu.eg', 1, '13:00', '14:30', 'Math Pavilion A-102'),
  ('layla.zaki@galala.edu.eg', 3, '11:00', '12:30', 'Engineering Annex E-205')
) AS v(email, dow, start_time, end_time, location)
JOIN users u ON lower(u.email) = lower(v.email)
JOIN instructors i ON i.user_id = u.id;

INSERT INTO office_hour_bookings (slot_id, student_id, booking_date, topic, status)
SELECT oh.id, s.id, '2027-03-07'::DATE, 'CS201 Graph Algorithms & Research Advising', 'booked'
FROM office_hour_slots oh
JOIN instructors i ON i.id = oh.instructor_id
JOIN users u ON u.id = i.user_id AND lower(u.email) = 'amina.darwish@galala.edu.eg'
JOIN students s ON s.student_number = '2024001'
LIMIT 1;

INSERT INTO evaluation_submissions (offering_id, student_id)
SELECT o.id, s.id
FROM students s, courses c, terms t, course_offerings o
WHERE s.student_number IN ('2024002', '2024003')
  AND c.code = 'CS101' AND t.name = 'Fall 2026'
  AND o.course_id = c.id AND o.term_id = t.id AND o.section = '01';

INSERT INTO evaluation_responses (offering_id, rating_teaching, rating_content, rating_fairness, comment)
SELECT o.id, v.t_rating, v.c_rating, v.f_rating, v.comment
FROM (VALUES
  (5, 5, 5, 'Well-structured labs and timely feedback.'),
  (5, 4, 5, 'Clear lecture examples and fair exams.')
) AS v(t_rating, c_rating, f_rating, comment)
JOIN courses c ON c.code = 'CS101'
JOIN terms t ON t.name = 'Fall 2026'
JOIN course_offerings o ON o.course_id = c.id AND o.term_id = t.id AND o.section = '01';

INSERT INTO academic_calendar_events (term_id, title, event_type, event_date)
SELECT t.id, v.title, v.event_type, v.event_date::DATE
FROM (VALUES
  ('Spring 2027 Registration Opens', 'registration', '2027-01-18'),
  ('Add / Drop Swap Deadline', 'add_drop', '2027-02-14'),
  ('Last Day to Withdraw with W Grade', 'withdrawal', '2027-04-08'),
  ('Spring 2027 Final Examination Period', 'exams', '2027-05-10'),
  ('Annual Honours Convocation', 'commencement', '2027-05-28')
) AS v(title, event_type, event_date)
JOIN terms t ON t.name = 'Spring 2027';

INSERT INTO tuition_ledger (student_id, term_id, entry_type, description, amount, created_by)
SELECT s.id, t.id, v.entry_type, v.description, v.amount, a.id
FROM (VALUES
  ('2024001', 'tuition_charge', 'Spring 2027 Tuition & Labs Assessment', 4500.00),
  ('2024001', 'scholarship_waiver', 'Dean''s List Merit Scholarship (25%)', -1125.00),
  ('2024001', 'payment', 'Electronic Bursar Settlement #TX-9041', -3375.00),
  ('2024006', 'tuition_charge', 'Spring 2027 Tuition Assessment (3 cr + fee)', 1750.00)
) AS v(student_number, entry_type, description, amount)
JOIN students s ON s.student_number = v.student_number
JOIN terms t ON t.name = 'Spring 2027'
JOIN users a ON lower(a.email) = 'admin@galala.edu.eg';

COMMIT;
