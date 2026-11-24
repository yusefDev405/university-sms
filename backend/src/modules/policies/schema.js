import { z } from 'zod';

export const idParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const createHoldSchema = {
  body: z.object({
    studentId: z.coerce.number().int().positive(),
    reason: z.string().trim().min(3).max(200)
  }).strict()
};
