import { z } from 'zod';

const studentProfileInput = z.object({
  studentNumber: z.string().trim().min(3).max(32),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departmentId: z.coerce.number().int().positive(),
  status: z.enum(['active', 'suspended', 'graduated']).default('active')
}).strict();

const instructorProfileInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(40),
  departmentId: z.coerce.number().int().positive()
}).strict();

export const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    role: z.enum(['student', 'instructor', 'admin']).optional(),
    active: z.enum(['true', 'false']).optional(),
    search: z.string().trim().optional()
  }).strict()
};

export const createUserSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['student', 'instructor', 'admin']),
    isActive: z.boolean().default(true),
    studentProfile: studentProfileInput.optional(),
    instructorProfile: instructorProfileInput.optional()
  }).strict()
};

export const updateUserSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    role: z.enum(['student', 'instructor', 'admin']).optional(),
    isActive: z.boolean().optional()
  }).strict().refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: 'At least one field (role or isActive) must be provided'
  })
};
