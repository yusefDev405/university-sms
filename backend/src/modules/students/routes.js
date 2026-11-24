import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  createStudentSchema,
  listStudentsSchema,
  studentIdParamSchema,
  updateStudentSchema
} from './schema.js';

const router = Router();

router.get('/students', authenticate, requireRole('admin', 'instructor'), validate(listStudentsSchema), controller.listStudents);
router.get('/students/:id', authenticate, requireRole('admin', 'instructor'), validate(studentIdParamSchema), controller.getStudentById);
router.post('/students', authenticate, requireRole('admin'), validate(createStudentSchema), controller.createStudent);
router.patch('/students/:id', authenticate, requireRole('admin'), validate(updateStudentSchema), controller.updateStudent);
router.get('/students/:id/transcript', authenticate, requireRole('admin'), validate(studentIdParamSchema), controller.getStudentTranscript);
router.get('/students/:id/transcript/pdf', authenticate, requireRole('admin'), validate(studentIdParamSchema), controller.downloadStudentTranscriptPdf);

export default router;
