import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { createHoldSchema, idParamSchema } from './schema.js';

const router = Router();

router.get('/me/notifications', authenticate, controller.listMyNotifications);
router.patch('/me/notifications/:id/read', authenticate, validate(idParamSchema), controller.markNotificationRead);
router.get('/me/holds', authenticate, requireRole('student'), controller.listMyHolds);

router.get('/holds', authenticate, requireRole('admin'), controller.listAllHolds);
router.post('/holds', authenticate, requireRole('admin'), validate(createHoldSchema), controller.createHold);
router.patch('/holds/:id/resolve', authenticate, requireRole('admin'), validate(idParamSchema), controller.resolveHold);

export default router;
