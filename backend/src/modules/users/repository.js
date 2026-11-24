import { query, withTransaction } from '../../config/db.js';

export async function listUsers({ role, active, search, limit, offset, sortColumn, sortDirection }) {
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`u.role = $${params.length}`);
  }
  if (active !== undefined) {
    params.push(active === 'true');
    conditions.push(`u.is_active = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.email ILIKE $${params.length} OR s.student_number ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortExpr = sortColumn === 'email' ? 'u.email' : sortColumn === 'role' ? 'u.role' : 'u.created_at';

  const countRes = await query(
    `SELECT count(*)::INT AS total
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     ${where}`, // sql-safe: parameterized filters only
    params
  );

  const listParams = [...params, limit, offset];
  const rowsRes = await query(
    `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
            s.id AS student_id, s.student_number,
            i.id AS instructor_id,
            COALESCE(s.first_name, i.first_name) AS first_name,
            COALESCE(s.last_name, i.last_name) AS last_name
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     LEFT JOIN instructors i ON i.user_id = u.id
     ${where}
     ORDER BY ${sortExpr} ${sortDirection}, u.id ASC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, // sql-safe: whitelisted sortExpr/direction
    listParams
  );

  return { rows: rowsRes.rows, total: countRes.rows[0].total };
}

export async function createUserWithProfile({ email, passwordHash, role, isActive, studentProfile, instructorProfile }, actorUserId) {
  return withTransaction(async (tx) => {
    const userRes = await tx.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, is_active, created_at`,
      [email, passwordHash, role, isActive]
    );
    const user = userRes.rows[0];

    let profile = null;
    if (role === 'student' && studentProfile) {
      const sRes = await tx.query(
        `INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, student_number, first_name, last_name, date_of_birth, department_id, status`,
        [
          user.id,
          studentProfile.studentNumber,
          studentProfile.firstName,
          studentProfile.lastName,
          studentProfile.dateOfBirth,
          studentProfile.departmentId,
          studentProfile.status
        ]
      );
      profile = sRes.rows[0];
    } else if (role === 'instructor' && instructorProfile) {
      const iRes = await tx.query(
        `INSERT INTO instructors (user_id, department_id, first_name, last_name, title)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, department_id, first_name, last_name, title`,
        [
          user.id,
          instructorProfile.departmentId,
          instructorProfile.firstName,
          instructorProfile.lastName,
          instructorProfile.title
        ]
      );
      profile = iRes.rows[0];
    }

    return { ...user, profile };
  }, { actorUserId });
}

export async function updateUser(id, { role, isActive }) {
  const sets = [];
  const params = [];

  if (role !== undefined) {
    params.push(role);
    sets.push(`role = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    sets.push(`is_active = $${params.length}`);
  }

  params.push(id);
  const res = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} -- sql-safe: fixed column assignments
     RETURNING id, email, role, is_active, created_at`,
    params
  );
  return res.rows[0] || null;
}

export async function listInstructors() {
  const res = await query(
    `SELECT i.id, i.user_id, i.first_name, i.last_name, i.title, i.department_id, d.code AS department_code, u.email
     FROM instructors i
     JOIN departments d ON d.id = i.department_id
     JOIN users u ON u.id = i.user_id
     ORDER BY i.last_name ASC, i.first_name ASC`
  );
  return res.rows;
}
