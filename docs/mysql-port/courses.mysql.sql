-- courses.mysql.sql
-- Cross-engine portability reference: MySQL 8.0 equivalent of the courses & prerequisites module.
-- Key dialect differences from PostgreSQL 16:
--   1. BIGINT GENERATED ALWAYS AS IDENTITY -> BIGINT AUTO_INCREMENT
--   2. JSONB -> JSON
--   3. PL/pgSQL FUNCTION returning TEXT -> MySQL PROCEDURE with OUT parameter & SIGNAL SQLSTATE
--   4. Positional parameters ($1, $2) -> ? placeholders in application queries

CREATE TABLE departments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

CREATE TABLE courses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  credits INT NOT NULL CHECK (credits BETWEEN 1 AND 6),
  department_id BIGINT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_courses_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE course_prerequisites (
  course_id BIGINT NOT NULL,
  prerequisite_id BIGINT NOT NULL,
  PRIMARY KEY (course_id, prerequisite_id),
  CONSTRAINT chk_prereq_not_self CHECK (course_id <> prerequisite_id),
  CONSTRAINT fk_prereq_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_prereq_target FOREIGN KEY (prerequisite_id) REFERENCES courses(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER //
CREATE PROCEDURE add_course_prerequisite(IN p_course_id BIGINT, IN p_prereq_id BIGINT)
BEGIN
  IF p_course_id = p_prereq_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A course cannot be its own prerequisite';
  END IF;
  INSERT INTO course_prerequisites (course_id, prerequisite_id)
  VALUES (p_course_id, p_prereq_id);
END //
DELIMITER ;
