import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  createEnrollmentSchema,
  enrollmentIdParamSchema,
  myEnrollmentsSchema,
  swapEnrollmentSchema
} from './schema.js';

const router = Router();

router.post('/enrollments', authenticate, requireRole('student'), validate(createEnrollmentSchema), controller.createEnrollment);
router.post('/enrollments/swap', authenticate, requireRole('student'), validate(swapEnrollmentSchema), controller.swapEnrollment);
router.delete('/enrollments/:id', authenticate, requireRole('student', 'admin'), validate(enrollmentIdParamSchema), controller.dropEnrollment);
router.get('/me/enrollments', authenticate, requireRole('student'), validate(myEnrollmentsSchema), controller.getMyEnrollments);
router.get('/me/transcript', authenticate, requireRole('student'), controller.getMyTranscript);
router.get('/me/transcript/pdf', authenticate, requireRole('student'), controller.downloadMyTranscriptPdf);
router.get('/me/degree-audit', authenticate, requireRole('student'), controller.getMyDegreeAudit);

export default router;
