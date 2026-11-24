import { z } from 'zod';

export const auditLogSchema = {
  query: z.object({
    entity: z.string().trim().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).strict()
};

export const importStudentsSchema = {
  body: z.object({
    csv: z.string().min(1).max(200000)
  }).strict()
};
