import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  createOfferingSchema,
  listOfferingsSchema,
  offeringIdParamSchema,
  updateOfferingSchema
} from './schema.js';

const router = Router();

router.get('/offerings', authenticate, validate(listOfferingsSchema), controller.listOfferings);
router.get('/offerings/:id', authenticate, validate(offeringIdParamSchema), controller.getOfferingById);
router.post('/offerings', authenticate, requireRole('admin'), validate(createOfferingSchema), controller.createOffering);
router.patch('/offerings/:id', authenticate, requireRole('admin'), validate(updateOfferingSchema), controller.updateOffering);
router.get('/offerings/:id/roster', authenticate, requireRole('instructor', 'admin'), validate(offeringIdParamSchema), controller.getOfferingRoster);
router.get('/offerings/:id/grade-distribution', authenticate, requireRole('instructor', 'admin'), validate(offeringIdParamSchema), controller.getGradeDistribution);

export default router;
