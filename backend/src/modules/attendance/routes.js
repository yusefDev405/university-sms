import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { offeringIdParamSchema, recordAttendanceSchema } from './schema.js';

const router = Router();

router.get('/offerings/:id/attendance', authenticate, requireRole('instructor', 'admin'), validate(offeringIdParamSchema), controller.getOfferingAttendance);
router.post('/offerings/:id/attendance', authenticate, requireRole('instructor', 'admin'), validate(recordAttendanceSchema), controller.recordAttendance);
router.get('/me/attendance', authenticate, requireRole('student'), controller.getMyAttendance);

export default router;
