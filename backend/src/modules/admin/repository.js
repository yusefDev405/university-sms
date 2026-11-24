import { query, withTransaction } from '../../config/db.js';

export async function getEnrollmentByDepartmentReport() {
  const [byDepartment, standings] = await Promise.all([
    query(
      `SELECT d.id, d.code, d.name,
              COUNT(DISTINCT s.id)::INT AS student_count,
              COUNT(e.id) FILTER (WHERE e.status = 'enrolled')::INT AS active_enrollments,
              COUNT(e.id) FILTER (WHERE e.status = 'waitlisted')::INT AS waitlisted_enrollments,
              COUNT(e.id) FILTER (WHERE e.status = 'completed')::INT AS completed_enrollments,
              ROUND(AVG(g.gpa), 2) AS avg_gpa
       FROM departments d
       LEFT JOIN students s ON s.department_id = d.id
       LEFT JOIN enrollments e ON e.student_id = s.id
       LEFT JOIN v_student_gpa g ON g.student_id = s.id
       GROUP BY d.id
       ORDER BY d.code ASC`
    ),
    query(
      `SELECT s.student_number,
              s.first_name || ' ' || s.last_name AS full_name,
              d.code AS department_code,
              g.gpa,
              g.credits_earned,
              RANK() OVER (PARTITION BY s.department_id ORDER BY g.gpa DESC)::INT AS dept_rank
       FROM v_student_gpa g
       JOIN students s ON s.id = g.student_id
       JOIN departments d ON d.id = s.department_id
       ORDER BY d.code ASC, dept_rank ASC, s.student_number ASC`
    )
  ]);

  return {
    departments: byDepartment.rows,
    standings: standings.rows
  };
}

export async function listAuditLog({ entity, from, to, limit, offset }) {
  const conditions = [];
  const params = [];

  if (entity) {
    params.push(entity);
    conditions.push(`a.entity = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`a.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`a.created_at <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT count(*)::INT AS total FROM audit_log a ${where}`, // sql-safe: parameterized filters
    params
  );

  const listParams = [...params, limit, offset];
  const rowsRes = await query(
    `SELECT a.id, a.actor_user_id, u.email AS actor_email, a.action, a.entity, a.entity_id,
            a.old_data, a.new_data, a.created_at
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_user_id
     ${where}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, // sql-safe: parameterized limit/offset
    listParams
  );

  return { rows: rowsRes.rows, total: countRes.rows[0].total };
}

export async function getDepartmentsMap() {
  const res = await query('SELECT id, code FROM departments');
  const map = new Map();
  for (const row of res.rows) {
    map.set(row.code.toUpperCase(), row.id);
  }
  return map;
}

export async function bulkInsertStudents(validRows, actorUserId) {
  return withTransaction(async (tx) => {
    const inserted = [];
    for (const row of validRows) {
      const userRes = await tx.query(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES ($1, $2, 'student', true)
         RETURNING id, email`,
        [row.email, row.passwordHash]
      );
      const userId = userRes.rows[0].id;
      const studentRes = await tx.query(
        `INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         RETURNING id, student_number, first_name, last_name`,
        [userId, row.studentNumber, row.firstName, row.lastName, row.dateOfBirth, row.departmentId]
      );
      inserted.push({ ...studentRes.rows[0], email: row.email });
    }
    return inserted;
  }, { actorUserId });
}
