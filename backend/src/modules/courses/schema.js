import { z } from 'zod';

export const listCoursesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    department: z.string().trim().optional(),
    search: z.string().trim().optional()
  }).strict()
};

export const courseIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const createCourseSchema = {
  body: z.object({
    code: z.string().trim().min(2).max(20).transform((s) => s.toUpperCase()),
    title: z.string().trim().min(2).max(160),
    credits: z.coerce.number().int().min(1).max(6),
    departmentId: z.coerce.number().int().positive()
  }).strict()
};

export const updateCourseSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    code: z.string().trim().min(2).max(20).transform((s) => s.toUpperCase()).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    credits: z.coerce.number().int().min(1).max(6).optional(),
    departmentId: z.coerce.number().int().positive().optional()
  }).strict().refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
};

export const replacePrerequisitesSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    prerequisiteIds: z.array(z.coerce.number().int().positive()).max(10)
  }).strict()
};
