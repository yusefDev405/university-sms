import { z } from 'zod';

export const createTermSchema = {
  body: z.object({
    name: z.string().trim().min(3).max(60),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    registrationOpens: z.string().datetime({ offset: true }),
    registrationCloses: z.string().datetime({ offset: true }),
    withdrawalCloses: z.string().datetime({ offset: true }).optional()
  }).strict()
};

export const updateTermSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    name: z.string().trim().min(3).max(60).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    registrationOpens: z.string().datetime({ offset: true }).optional(),
    registrationCloses: z.string().datetime({ offset: true }).optional(),
    withdrawalCloses: z.string().datetime({ offset: true }).optional()
  }).strict().refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
};
