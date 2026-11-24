import { z } from 'zod';

const meetingSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/)
}).strict();

export const listOfferingsSchema = {
  query: z.object({
    termId: z.coerce.number().int().positive().optional(),
    department: z.string().trim().optional(),
    search: z.string().trim().optional(),
    mine: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).strict()
};

export const offeringIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const createOfferingSchema = {
  body: z.object({
    courseId: z.coerce.number().int().positive(),
    termId: z.coerce.number().int().positive(),
    instructorId: z.coerce.number().int().positive(),
    section: z.string().trim().min(1).max(16),
    capacity: z.coerce.number().int().min(1).max(1000),
    room: z.string().trim().min(1).max(60),
    meetings: z.array(meetingSchema).max(7).default([])
  }).strict()
};

export const updateOfferingSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    instructorId: z.coerce.number().int().positive().optional(),
    section: z.string().trim().min(1).max(16).optional(),
    capacity: z.coerce.number().int().min(1).max(1000).optional(),
    room: z.string().trim().min(1).max(60).optional(),
    meetings: z.array(meetingSchema).max(7).optional()
  }).strict().refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
};
