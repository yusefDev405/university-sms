import { AppError } from '../utils/errors.js';

/**
 * Defense-in-depth CSRF protection on cookie-authenticated endpoints (/auth/refresh, /auth/logout):
 * paired with SameSite=Strict cookies, requires an explicit custom header that simple cross-site
 * HTML forms cannot forge.
 */
export function requireCsrfHeader(req, _res, next) {
  const header = req.headers['x-requested-with'];
  if (header !== 'XMLHttpRequest') {
    return next(new AppError(403, 'CSRF_REQUIRED', 'Missing required X-Requested-With header'));
  }
  return next();
}
