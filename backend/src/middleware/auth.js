import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';

export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, 'TOKEN_INVALID', 'Invalid or expired access token');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(401, 'TOKEN_INVALID', 'Invalid token subject');
    }

    const userRes = await query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [userId]
    );
    const user = userRes.rows[0];
    if (!user || !user.is_active) {
      throw new AppError(401, 'UNAUTHORIZED', 'Account is inactive or no longer exists');
    }

    req.user = {
      id: Number(user.id),
      email: user.email,
      role: user.role
    };
    next();
  } catch (err) {
    next(err);
  }
}
