import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  bookOfficeHourSchema,
  createCalendarEventSchema,
  createExamSchema,
  createOfficeHourSlotSchema,
  createRoomSchema,
  idParamSchema,
  submitEvaluationSchema
} from './schema.js';

const router = Router();

router.get('/rooms', authenticate, controller.listRooms);
router.post('/rooms', authenticate, requireRole('admin'), validate(createRoomSchema), controller.createRoom);
router.delete('/rooms/:id', authenticate, requireRole('admin'), validate(idParamSchema), controller.deleteRoom);

router.get('/exams', authenticate, controller.listExams);
router.get('/me/exams', authenticate, requireRole('student'), controller.listMyExams);
router.post('/exams', authenticate, requireRole('admin'), validate(createExamSchema), controller.createExam);
router.delete('/exams/:id', authenticate, requireRole('admin'), validate(idParamSchema), controller.deleteExam);

router.get('/office-hours', authenticate, controller.listOfficeHours);
router.post('/office-hours/slots', authenticate, requireRole('instructor', 'admin'), validate(createOfficeHourSlotSchema), controller.createOfficeHourSlot);
router.delete('/office-hours/slots/:id', authenticate, requireRole('instructor', 'admin'), validate(idParamSchema), controller.deleteOfficeHourSlot);
router.post('/office-hours/bookings', authenticate, requireRole('student'), validate(bookOfficeHourSchema), controller.bookOfficeHour);
router.patch('/office-hours/bookings/:id/cancel', authenticate, validate(idParamSchema), controller.cancelBooking);

router.get('/me/evaluations', authenticate, requireRole('student'), controller.listMyEvaluations);
router.post('/evaluations', authenticate, requireRole('student'), validate(submitEvaluationSchema), controller.submitEvaluation);
router.get('/offerings/:id/evaluations/summary', authenticate, requireRole('instructor', 'admin'), validate(idParamSchema), controller.getEvaluationSummary);

router.get('/calendar', authenticate, controller.listCalendarEvents);
router.post('/calendar', authenticate, requireRole('admin'), validate(createCalendarEventSchema), controller.createCalendarEvent);
router.delete('/calendar/:id', authenticate, requireRole('admin'), validate(idParamSchema), controller.deleteCalendarEvent);

router.get('/admin/analytics/executive', authenticate, requireRole('admin'), controller.getExecutiveAnalytics);

export default router;
