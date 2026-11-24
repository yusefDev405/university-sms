import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireCsrfHeader } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { changePasswordSchema, loginSchema } from './schema.js';

export function createAuthRouter({ authLimiter } = {}) {
  const router = Router();
  const limitMiddleware = authLimiter || ((_req, _res, next) => next());

  router.post('/auth/login', limitMiddleware, validate(loginSchema), controller.login);
  router.post('/auth/refresh', limitMiddleware, requireCsrfHeader, controller.refresh);
  router.post('/auth/logout', requireCsrfHeader, controller.logout);
  router.get('/me', authenticate, controller.me);
  router.patch('/me/password', authenticate, validate(changePasswordSchema), controller.changePassword);

  return router;
}
