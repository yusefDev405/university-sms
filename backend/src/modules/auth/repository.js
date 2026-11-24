import { query, withTransaction } from '../../config/db.js';

export async function findUserByEmail(email) {
  const res = await query(
    `SELECT id, email, password_hash, role, is_active, failed_login_attempts, locked_until, created_at
     FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return res.rows[0] || null;
}

export async function recordFailedLogin(userId) {
  const res = await query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes'
           ELSE locked_until
         END
     WHERE id = $1
     RETURNING failed_login_attempts, locked_until`,
    [userId]
  );
  return res.rows[0] || null;
}

export async function resetFailedLogins(userId) {
  await query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1 AND (failed_login_attempts > 0 OR locked_until IS NOT NULL)',
    [userId]
  );
}

export async function findUserWithProfileById(userId) {
  const userRes = await query(
    'SELECT id, email, role, is_active, created_at FROM users WHERE id = $1',
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) return null;

  let profile = null;
  if (user.role === 'student') {
    const res = await query(
      `SELECT s.id, s.student_number, s.first_name, s.last_name, s.date_of_birth,
              s.department_id, d.code AS department_code, d.name AS department_name, s.status
       FROM students s
       JOIN departments d ON d.id = s.department_id
       WHERE s.user_id = $1`,
      [userId]
    );
    profile = res.rows[0] || null;
  } else if (user.role === 'instructor') {
    const res = await query(
      `SELECT i.id, i.first_name, i.last_name, i.title,
              i.department_id, d.code AS department_code, d.name AS department_name
       FROM instructors i
       JOIN departments d ON d.id = i.department_id
       WHERE i.user_id = $1`,
      [userId]
    );
    profile = res.rows[0] || null;
  }

  return { ...user, profile };
}

export async function insertRefreshToken({ userId, familyId, tokenHash, expiresAt }) {
  const res = await query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, family_id, expires_at`,
    [userId, familyId, tokenHash, expiresAt]
  );
  return res.rows[0];
}

export async function findRefreshTokenByHash(tokenHash) {
  const res = await query(
    `SELECT rt.id, rt.user_id, rt.family_id, rt.token_hash, rt.expires_at, rt.revoked_at,
            u.role, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );
  return res.rows[0] || null;
}

export async function revokeTokenFamily(familyId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1',
    [familyId]
  );
}

export async function revokeRefreshTokenByHash(tokenHash) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1',
    [tokenHash]
  );
}

export async function rotateRefreshToken({ oldTokenId, userId, familyId, newTokenHash, expiresAt }) {
  return withTransaction(async (tx) => {
    await tx.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [oldTokenId]);
    const res = await tx.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, familyId, newTokenHash, expiresAt]
    );
    return res.rows[0];
  });
}

export async function getUserPasswordHash(userId) {
  const res = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return res.rows[0]?.password_hash || null;
}

export async function updateUserPasswordHash(userId, newHash) {
  await withTransaction(async (tx) => {
    await tx.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    await tx.query('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1', [userId]);
  });
}
