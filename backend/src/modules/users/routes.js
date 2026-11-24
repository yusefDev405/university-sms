import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { createUserSchema, listUsersSchema, updateUserSchema } from './schema.js';

const router = Router();

router.get('/users', authenticate, requireRole('admin'), validate(listUsersSchema), controller.listUsers);
router.post('/users', authenticate, requireRole('admin'), validate(createUserSchema), controller.createUser);
router.patch('/users/:id', authenticate, requireRole('admin'), validate(updateUserSchema), controller.updateUser);
router.get('/instructors', authenticate, requireRole('admin'), controller.listInstructors);

export default router;
