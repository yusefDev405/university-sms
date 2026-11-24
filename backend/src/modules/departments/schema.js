import { z } from 'zod';

export const createDepartmentSchema = {
  body: z.object({
    code: z.string().trim().min(2).max(16).transform((s) => s.toUpperCase()),
    name: z.string().trim().min(2).max(120)
  }).strict()
};
