import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { createTermSchema, updateTermSchema } from './schema.js';

const router = Router();

router.get('/terms', authenticate, controller.listTerms);
router.post('/terms', authenticate, requireRole('admin'), validate(createTermSchema), controller.createTerm);
router.patch('/terms/:id', authenticate, requireRole('admin'), validate(updateTermSchema), controller.updateTerm);

export default router;
