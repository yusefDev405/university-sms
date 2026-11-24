import { z } from 'zod';

export const offeringIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const recordAttendanceSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    topic: z.string().trim().max(160).default(''),
    records: z.array(
      z.object({
        studentId: z.coerce.number().int().positive(),
        status: z.enum(['present', 'absent', 'late', 'excused']),
        note: z.string().trim().max(200).optional()
      }).strict()
    ).min(1).max(200)
  }).strict()
};
