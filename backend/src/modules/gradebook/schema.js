import { z } from 'zod';

export const offeringIdParamSchema = {
  params: z.object({ id: z.coerce.number().int().positive() })
};

export const assessmentIdParamSchema = {
  params: z.object({ assessmentId: z.coerce.number().int().positive() })
};

export const createAssessmentSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    title: z.string().trim().min(2).max(120),
    category: z.enum(['assignment', 'quiz', 'midterm', 'project', 'final', 'participation']),
    weightPct: z.coerce.number().positive().max(100),
    maxScore: z.coerce.number().positive().max(1000),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
  }).strict()
};

export const upsertScoresSchema = {
  params: z.object({ assessmentId: z.coerce.number().int().positive() }),
  body: z.object({
    scores: z.array(
      z.object({
        studentId: z.coerce.number().int().positive(),
        score: z.coerce.number().min(0).max(1000),
        feedback: z.string().trim().max(500).nullable().optional()
      }).strict()
    ).min(1).max(300)
  }).strict()
};

export const createAnnouncementSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    title: z.string().trim().min(2).max(140),
    body: z.string().trim().min(2).max(2000)
  }).strict()
};

export const updateSyllabusSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    syllabusSummary: z.string().trim().min(5).max(2000)
  }).strict()
};
