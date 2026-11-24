import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  addDegreePlanItemSchema,
  createEarlyAlertSchema,
  createGradeAppealSchema,
  createOverridePetitionSchema,
  decideGradeAppealSchema,
  decideOverridePetitionSchema,
  idParamSchema,
  setCourseLinksSchema,
  updateEarlyAlertStatusSchema
} from './schema.js';

const router = Router();

router.get('/grade-appeals', authenticate, controller.listGradeAppeals);
router.post('/grade-appeals', authenticate, requireRole('student'), validate(createGradeAppealSchema), controller.createGradeAppeal);
router.patch('/grade-appeals/:id/decide', authenticate, requireRole('instructor', 'admin'), validate(decideGradeAppealSchema), controller.decideGradeAppeal);

router.get('/override-petitions', authenticate, controller.listOverridePetitions);
router.post('/override-petitions', authenticate, requireRole('student'), validate(createOverridePetitionSchema), controller.createOverridePetition);
router.patch('/override-petitions/:id/decide', authenticate, requireRole('instructor', 'admin'), validate(decideOverridePetitionSchema), controller.decideOverridePetition);

router.get('/advising/advisees', authenticate, requireRole('instructor', 'admin'), controller.listAdvisees);
router.get('/early-alerts', authenticate, controller.listEarlyAlerts);
router.post('/early-alerts', authenticate, requireRole('instructor', 'admin'), validate(createEarlyAlertSchema), controller.createEarlyAlert);
router.patch('/early-alerts/:id/status', authenticate, requireRole('instructor', 'admin'), validate(updateEarlyAlertStatusSchema), controller.updateEarlyAlertStatus);

router.get('/me/degree-plan', authenticate, requireRole('student'), controller.listMyDegreePlan);
router.post('/me/degree-plan', authenticate, requireRole('student'), validate(addDegreePlanItemSchema), controller.addMyDegreePlanItem);
router.delete('/me/degree-plan/:id', authenticate, requireRole('student'), validate(idParamSchema), controller.deleteMyDegreePlanItem);

router.get('/courses/:id/relations', authenticate, validate(idParamSchema), controller.getCourseRelations);
router.put('/courses/:id/corequisites', authenticate, requireRole('admin'), validate(setCourseLinksSchema), controller.setCourseCorequisites);
router.put('/courses/:id/equivalencies', authenticate, requireRole('admin'), validate(setCourseLinksSchema), controller.setCourseEquivalencies);

export default router;
