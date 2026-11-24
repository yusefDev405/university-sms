-- 001_schema.sql
-- Normalized 3NF PostgreSQL 16 schema for University Student Management System (12 tables)

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

CREATE TABLE IF NOT EXISTS students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  student_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'graduated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instructors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  credits INT NOT NULL CHECK (credits BETWEEN 1 AND 6),
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_prerequisites (
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  PRIMARY KEY (course_id, prerequisite_id),
  CHECK (course_id <> prerequisite_id)
);

CREATE TABLE IF NOT EXISTS terms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_opens TIMESTAMPTZ NOT NULL,
  registration_closes TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_date < end_date),
  CHECK (registration_opens <= registration_closes)
);

CREATE TABLE IF NOT EXISTS course_offerings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  term_id BIGINT NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  instructor_id BIGINT NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  section TEXT NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  room TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, term_id, section)
);

CREATE TABLE IF NOT EXISTS offering_meetings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  offering_id BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('enrolled', 'waitlisted', 'dropped', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade_points NUMERIC(3, 2) CHECK (grade_points >= 0.00 AND grade_points <= 4.00),
  grade_letter TEXT CHECK (grade_letter IN ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F')),
  UNIQUE (student_id, offering_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity TEXT NOT NULL,
  entity_id BIGINT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
