import { z } from 'zod';

export const createEnrollmentSchema = {
  body: z.object({
    offeringId: z.coerce.number().int().positive()
  }).strict()
};

export const enrollmentIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const myEnrollmentsSchema = {
  query: z.object({
    termId: z.coerce.number().int().positive().optional()
  }).strict()
};
