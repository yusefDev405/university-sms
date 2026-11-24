import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { bulkGradesSchema, setSingleGradeSchema } from './schema.js';

const router = Router();

router.put('/enrollments/:id/grade', authenticate, requireRole('instructor', 'admin'), validate(setSingleGradeSchema), controller.setSingleGrade);
router.post('/offerings/:id/grades/bulk', authenticate, requireRole('instructor', 'admin'), validate(bulkGradesSchema), controller.setBulkGrades);

export default router;
