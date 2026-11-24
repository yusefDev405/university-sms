import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  createEnrollmentSchema,
  enrollmentIdParamSchema,
  myEnrollmentsSchema
} from './schema.js';

const router = Router();

router.post('/enrollments', authenticate, requireRole('student'), validate(createEnrollmentSchema), controller.createEnrollment);
router.delete('/enrollments/:id', authenticate, requireRole('student', 'admin'), validate(enrollmentIdParamSchema), controller.dropEnrollment);
router.get('/me/enrollments', authenticate, requireRole('student'), validate(myEnrollmentsSchema), controller.getMyEnrollments);
router.get('/me/transcript', authenticate, requireRole('student'), controller.getMyTranscript);
router.get('/me/transcript/pdf', authenticate, requireRole('student'), controller.downloadMyTranscriptPdf);

export default router;
