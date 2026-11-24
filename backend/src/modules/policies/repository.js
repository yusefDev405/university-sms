import { query } from '../../config/db.js';

export async function listNotifications(userId) {
  const res = await query(
    `SELECT id, user_id, title, message, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 30`,
    [userId]
  );
  return res.rows;
}

export async function markNotificationRead(id, userId) {
  const res = await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, title, message, read_at, created_at`,
    [id, userId]
  );
  return res.rows[0] || null;
}

export async function findStudentIdByUserId(userId) {
  const res = await query('SELECT id FROM students WHERE user_id = $1', [userId]);
  return res.rows[0]?.id || null;
}

export async function listHolds({ studentId = null, activeOnly = false } = {}) {
  const conditions = [];
  const params = [];
  if (studentId) {
    params.push(studentId);
    conditions.push(`h.student_id = $${params.length}`);
  }
  if (activeOnly) {
    conditions.push('h.resolved_at IS NULL');
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await query(
    `SELECT h.id, h.student_id, s.student_number,
            s.first_name || ' ' || s.last_name AS student_name,
            h.reason, h.created_at, h.resolved_at,
            pu.email AS placed_by_email, ru.email AS resolved_by_email
     FROM academic_holds h
     JOIN students s ON s.id = h.student_id
     LEFT JOIN users pu ON pu.id = h.placed_by
     LEFT JOIN users ru ON ru.id = h.resolved_by
     ${where}
     ORDER BY h.resolved_at IS NOT NULL ASC, h.created_at DESC`, // sql-safe: parameterized filters
    params
  );
  return res.rows;
}

export async function createHold({ studentId, reason, actorUserId }) {
  const res = await query(
    `INSERT INTO academic_holds (student_id, reason, placed_by)
     VALUES ($1, $2, $3)
     RETURNING id, student_id, reason, created_at, resolved_at`,
    [studentId, reason, actorUserId]
  );
  return res.rows[0];
}

export async function resolveHold(id, actorUserId) {
  const res = await query(
    `UPDATE academic_holds
     SET resolved_at = COALESCE(resolved_at, now()),
         resolved_by = COALESCE(resolved_by, $2)
     WHERE id = $1
     RETURNING id, student_id, reason, created_at, resolved_at`,
    [id, actorUserId]
  );
  return res.rows[0] || null;
}
