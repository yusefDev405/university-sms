import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  courseIdParamSchema,
  createCourseSchema,
  listCoursesSchema,
  replacePrerequisitesSchema,
  updateCourseSchema
} from './schema.js';

const router = Router();

router.get('/courses', authenticate, validate(listCoursesSchema), controller.listCourses);
router.get('/courses/:id', authenticate, validate(courseIdParamSchema), controller.getCourseById);
router.post('/courses', authenticate, requireRole('admin'), validate(createCourseSchema), controller.createCourse);
router.patch('/courses/:id', authenticate, requireRole('admin'), validate(updateCourseSchema), controller.updateCourse);
router.put('/courses/:id/prerequisites', authenticate, requireRole('admin'), validate(replacePrerequisitesSchema), controller.replacePrerequisites);

export default router;
