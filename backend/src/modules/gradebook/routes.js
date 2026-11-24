import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  assessmentIdParamSchema,
  createAnnouncementSchema,
  createAssessmentSchema,
  offeringIdParamSchema,
  updateSyllabusSchema,
  upsertScoresSchema
} from './schema.js';

const router = Router();

router.get('/me/coursework', authenticate, requireRole('student'), controller.myCoursework);

router.get('/offerings/:id/gradebook', authenticate, validate(offeringIdParamSchema), controller.getGradebook);
router.post('/offerings/:id/assessments', authenticate, requireRole('instructor', 'admin'), validate(createAssessmentSchema), controller.createAssessment);
router.delete('/assessments/:assessmentId', authenticate, requireRole('instructor', 'admin'), validate(assessmentIdParamSchema), controller.deleteAssessment);
router.put('/assessments/:assessmentId/scores', authenticate, requireRole('instructor', 'admin'), validate(upsertScoresSchema), controller.upsertScores);
router.post('/offerings/:id/grades/compute-from-gradebook', authenticate, requireRole('instructor', 'admin'), validate(offeringIdParamSchema), controller.computeFinalGrades);

router.get('/offerings/:id/announcements', authenticate, validate(offeringIdParamSchema), controller.listAnnouncements);
router.post('/offerings/:id/announcements', authenticate, requireRole('instructor', 'admin'), validate(createAnnouncementSchema), controller.createAnnouncement);
router.patch('/offerings/:id/syllabus', authenticate, requireRole('instructor', 'admin'), validate(updateSyllabusSchema), controller.updateSyllabus);

export default router;
