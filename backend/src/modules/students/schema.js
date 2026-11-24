import { z } from 'zod';

export const listStudentsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    department: z.string().trim().optional(),
    status: z.enum(['active', 'suspended', 'graduated']).optional(),
    search: z.string().trim().optional()
  }).strict()
};

export const studentIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const createStudentSchema = {
  body: z.object({
    userId: z.coerce.number().int().positive(),
    studentNumber: z.string().trim().min(3).max(32),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    departmentId: z.coerce.number().int().positive(),
    status: z.enum(['active', 'suspended', 'graduated']).default('active')
  }).strict()
};

export const updateStudentSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    status: z.enum(['active', 'suspended', 'graduated']).optional()
  }).strict().refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
};
