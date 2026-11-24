import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  createAdmissionSchema,
  createGraduationAppSchema,
  createTransferCreditSchema,
  decideGraduationAppSchema,
  idParamSchema,
  updateAdmissionStatusSchema,
  verifyCodeParamSchema
} from './schema.js';

const router = Router();

// Public unauthenticated degree verification portal endpoint
router.get('/verify/:code', validate(verifyCodeParamSchema), controller.verifyCredential);

router.get('/admissions', authenticate, requireRole('admin'), controller.listAdmissions);
router.post('/admissions', authenticate, requireRole('admin'), validate(createAdmissionSchema), controller.createAdmission);
router.patch('/admissions/:id/status', authenticate, requireRole('admin'), validate(updateAdmissionStatusSchema), controller.updateAdmissionStatus);
router.post('/admissions/:id/matriculate', authenticate, requireRole('admin'), validate(idParamSchema), controller.matriculateApplicant);

router.get('/transfer-credits', authenticate, requireRole('admin'), controller.listTransferCredits);
router.get('/me/transfer-credits', authenticate, requireRole('student'), controller.listTransferCredits);
router.post('/transfer-credits', authenticate, requireRole('admin'), validate(createTransferCreditSchema), controller.createTransferCredit);
router.delete('/transfer-credits/:id', authenticate, requireRole('admin'), validate(idParamSchema), controller.deleteTransferCredit);

router.get('/me/graduation-applications', authenticate, requireRole('student'), controller.listGraduationApplications);
router.post('/me/graduation-applications', authenticate, requireRole('student'), validate(createGraduationAppSchema), controller.applyForGraduation);
router.get('/graduation-applications', authenticate, requireRole('admin'), controller.listGraduationApplications);
router.patch('/graduation-applications/:id/decide', authenticate, requireRole('admin'), validate(decideGraduationAppSchema), controller.decideGraduationApplication);

export default router;
