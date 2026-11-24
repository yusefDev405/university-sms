import { z } from 'zod';
import { VALID_GRADE_LETTERS } from '../../utils/grades.js';

export const idParamSchema = {
  params: z.object({ id: z.coerce.number().int().positive() })
};

export const createGradeAppealSchema = {
  body: z.object({
    enrollmentId: z.coerce.number().int().positive(),
    requestedReason: z.string().trim().min(5).max(1000)
  }).strict()
};

export const decideGradeAppealSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    revisedGrade: z.enum(VALID_GRADE_LETTERS).nullable().optional(),
    decisionNote: z.string().trim().min(2).max(1000)
  }).strict()
};

export const createOverridePetitionSchema = {
  body: z.object({
    offeringId: z.coerce.number().int().positive(),
    petitionType: z.enum(['prerequisite', 'credit_overload', 'capacity']),
    reason: z.string().trim().min(5).max(1000)
  }).strict()
};

export const decideOverridePetitionSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    decisionNote: z.string().trim().min(2).max(1000)
  }).strict()
};

export const createEarlyAlertSchema = {
  body: z.object({
    studentId: z.coerce.number().int().positive(),
    offeringId: z.coerce.number().int().positive().nullable().optional(),
    flagType: z.enum(['attendance', 'academic_risk', 'missing_work', 'commendation']),
    note: z.string().trim().min(3).max(1000)
  }).strict()
};

export const updateEarlyAlertStatusSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    status: z.enum(['acknowledged', 'resolved'])
  }).strict()
};

export const addDegreePlanItemSchema = {
  body: z.object({
    termLabel: z.string().trim().min(2).max(60),
    courseId: z.coerce.number().int().positive(),
    notes: z.string().trim().max(300).nullable().optional()
  }).strict()
};

export const setCourseLinksSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    courseIds: z.array(z.coerce.number().int().positive()).max(20)
  }).strict()
};
