import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { createDepartmentSchema } from './schema.js';

const router = Router();

router.get('/departments', authenticate, controller.listDepartments);
router.post('/departments', authenticate, requireRole('admin'), validate(createDepartmentSchema), controller.createDepartment);

export default router;
