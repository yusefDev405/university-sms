import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { assessTermSchema, createLedgerEntrySchema } from './schema.js';

const router = Router();

router.get('/me/finance', authenticate, requireRole('student'), controller.myFinance);
router.get('/finance/ledger', authenticate, requireRole('admin'), controller.listLedger);
router.post('/finance/assess-term', authenticate, requireRole('admin'), validate(assessTermSchema), controller.assessTerm);
router.post('/finance/entries', authenticate, requireRole('admin'), validate(createLedgerEntrySchema), controller.createEntry);
router.post('/finance/enforce-holds', authenticate, requireRole('admin'), controller.enforceHolds);

export default router;
