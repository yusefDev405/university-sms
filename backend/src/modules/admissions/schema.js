import { z } from 'zod';

export const idParamSchema = {
  params: z.object({ id: z.coerce.number().int().positive() })
};

export const verifyCodeParamSchema = {
  params: z.object({ code: z.string().trim().min(4).max(60) })
};

export const createAdmissionSchema = {
  body: z.object({
    email: z.string().trim().email(),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    departmentId: z.coerce.number().int().positive(),
    entryScore: z.coerce.number().min(0).max(100),
    decisionNote: z.string().trim().max(500).optional()
  }).strict()
};

export const updateAdmissionStatusSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    status: z.enum(['under_review', 'admitted', 'rejected']),
    decisionNote: z.string().trim().max(500).optional()
  }).strict()
};

export const createTransferCreditSchema = {
  body: z.object({
    studentId: z.coerce.number().int().positive(),
    institutionName: z.string().trim().min(2).max(140),
    externalCourseCode: z.string().trim().min(2).max(40),
    equivalentCourseId: z.coerce.number().int().positive().nullable().optional(),
    credits: z.coerce.number().int().min(1).max(6)
  }).strict()
};

export const createGraduationAppSchema = {
  body: z.object({
    targetTerm: z.string().trim().min(3).max(60)
  }).strict()
};

export const decideGraduationAppSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    status: z.enum(['approved', 'conferred', 'denied']),
    decisionNote: z.string().trim().max(500).optional()
  }).strict()
};
