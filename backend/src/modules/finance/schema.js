import { z } from 'zod';

export const assessTermSchema = {
  body: z.object({
    termId: z.coerce.number().int().positive(),
    creditRate: z.coerce.number().positive().max(10000).default(500),
    registrationFee: z.coerce.number().min(0).max(5000).default(250)
  }).strict()
};

export const createLedgerEntrySchema = {
  body: z.object({
    studentId: z.coerce.number().int().positive(),
    termId: z.coerce.number().int().positive().nullable().optional(),
    entryType: z.enum(['tuition_charge', 'fee', 'scholarship_waiver', 'payment']),
    description: z.string().trim().min(3).max(200),
    amount: z.coerce.number().positive().max(100000)
  }).strict()
};
