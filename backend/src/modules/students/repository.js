import { query } from '../../config/db.js';

export async function listStudents({ department, status, search, instructorUserId, limit, offset, sortColumn, sortDirection }) {
  const conditions = [];
  const params = [];

  if (department) {
    params.push(department);
    conditions.push(`d.code = upper($${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(s.student_number ILIKE $${params.length} OR s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (instructorUserId) {
    params.push(instructorUserId);
    conditions.push(`EXISTS (
      SELECT 1 FROM enrollments e
      JOIN course_offerings co ON co.id = e.offering_id
      JOIN instructors i ON i.id = co.instructor_id
      WHERE e.student_id = s.id AND i.user_id = $${params.length} AND e.status <> 'dropped'
    )`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortExpr =
    sortColumn === 'student_number'
      ? 's.student_number'
      : sortColumn === 'last_name'
        ? 's.last_name'
        : 's.created_at';

  const countRes = await query(
    `SELECT count(*)::INT AS total
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     ${where}`, // sql-safe: parameterized filters
    params
  );

  const listParams = [...params, limit, offset];
  const rowsRes = await query(
    `SELECT s.id, s.user_id, s.student_number, s.first_name, s.last_name, s.date_of_birth,
            s.department_id, d.code AS department_code, d.name AS department_name,
            s.status, s.created_at, u.email, g.gpa, COALESCE(g.credits_earned, 0)::INT AS credits_earned,
            (SELECT count(*)::INT FROM academic_holds h WHERE h.student_id = s.id AND h.resolved_at IS NULL) AS active_hold_count
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     LEFT JOIN v_student_gpa g ON g.student_id = s.id
     ${where}
     ORDER BY ${sortExpr} ${sortDirection}, s.id ASC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, // sql-safe: whitelisted sortExpr/direction
    listParams
  );

  return { rows: rowsRes.rows, total: countRes.rows[0].total };
}

export async function findStudentById(studentId) {
  const res = await query(
    `SELECT s.id, s.user_id, s.student_number, s.first_name, s.last_name, s.date_of_birth,
            s.department_id, d.code AS department_code, d.name AS department_name,
            s.status, s.created_at, u.email, g.gpa, COALESCE(g.credits_earned, 0)::INT AS credits_earned,
            (SELECT count(*)::INT FROM academic_holds h WHERE h.student_id = s.id AND h.resolved_at IS NULL) AS active_hold_count
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     LEFT JOIN v_student_gpa g ON g.student_id = s.id
     WHERE s.id = $1`,
    [studentId]
  );
  return res.rows[0] || null;
}

export async function isStudentInInstructorRoster(studentId, instructorUserId) {
  const res = await query(
    `SELECT 1
     FROM enrollments e
     JOIN course_offerings co ON co.id = e.offering_id
     JOIN instructors i ON i.id = co.instructor_id
     WHERE e.student_id = $1 AND i.user_id = $2 AND e.status <> 'dropped'
     LIMIT 1`,
    [studentId, instructorUserId]
  );
  return res.rowCount > 0;
}

export async function createStudent(data) {
  const res = await query(
    `INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, student_number, first_name, last_name, date_of_birth, department_id, status, created_at`,
    [data.userId, data.studentNumber, data.firstName, data.lastName, data.dateOfBirth, data.departmentId, data.status]
  );
  return res.rows[0];
}

export async function updateStudent(id, data) {
  const sets = [];
  const params = [];
  const map = {
    firstName: 'first_name',
    lastName: 'last_name',
    dateOfBirth: 'date_of_birth',
    departmentId: 'department_id',
    status: 'status'
  };

  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) {
      params.push(data[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }

  params.push(id);
  const res = await query(
    `UPDATE students SET ${sets.join(', ')} WHERE id = $${params.length} -- sql-safe: fixed column mapping
     RETURNING id, user_id, student_number, first_name, last_name, date_of_birth, department_id, status, created_at`,
    params
  );
  return res.rows[0] || null;
}

export async function getStudentTranscript(studentId) {
  const student = await findStudentById(studentId);
  if (!student) return null;

  const [entriesRes, gpaRes, rankRes] = await Promise.all([
    query(
      `SELECT enrollment_id, term_id, term_name, term_start_date, course_id, course_code,
              course_title, credits, department_code, section, grade_letter, grade_points, enrolled_at
       FROM v_student_transcript
       WHERE student_id = $1
       ORDER BY term_start_date ASC, course_code ASC`,
      [studentId]
    ),
    query(
      `SELECT gpa, credits_attempted, credits_earned
       FROM v_student_gpa
       WHERE student_id = $1`,
      [studentId]
    ),
    query(
      `SELECT dept_rank, total_in_dept FROM (
         SELECT s.id,
                RANK() OVER (PARTITION BY s.department_id ORDER BY COALESCE(g.gpa, 0) DESC) AS dept_rank,
                COUNT(*) OVER (PARTITION BY s.department_id)::INT AS total_in_dept
         FROM students s
         LEFT JOIN v_student_gpa g ON g.student_id = s.id
         WHERE s.department_id = $2
       ) ranked WHERE id = $1`,
      [studentId, student.department_id]
    )
  ]);

  const gpaRow = gpaRes.rows[0] || { gpa: null, credits_attempted: 0, credits_earned: 0 };
  const rankRow = rankRes.rows[0] || null;
  const numericGpa = gpaRow.gpa !== null ? Number(gpaRow.gpa) : null;
  const earned = Number(gpaRow.credits_earned || 0);

  let standing = 'Good Standing';
  if (numericGpa !== null && numericGpa < 2.0) {
    standing = 'Academic Probation';
  } else if (numericGpa !== null && numericGpa >= 3.7 && earned >= 6) {
    standing = "Dean's List";
  }

  const maxTermCredits = numericGpa !== null && numericGpa < 2.0 ? 12 : 18;

  return {
    student,
    summary: {
      gpa: numericGpa,
      creditsAttempted: Number(gpaRow.credits_attempted || 0),
      creditsEarned: earned,
      departmentRank: rankRow ? Number(rankRow.dept_rank) : null,
      departmentTotal: rankRow ? Number(rankRow.total_in_dept) : null,
      standing,
      maxTermCredits
    },
    courses: entriesRes.rows
  };
}
