import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { auditLogSchema, importStudentsSchema } from './schema.js';

const router = Router();

router.get('/reports/enrollment-by-department', authenticate, requireRole('admin'), controller.getEnrollmentByDepartmentReport);
router.get('/audit-log', authenticate, requireRole('admin'), validate(auditLogSchema), controller.listAuditLog);
router.post('/admin/import/students', authenticate, requireRole('admin'), validate(importStudentsSchema), controller.importStudentsCsv);

export default router;
