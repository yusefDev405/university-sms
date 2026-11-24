import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const idParamSchema = {
  params: z.object({ id: z.coerce.number().int().positive() })
};

export const createRoomSchema = {
  body: z.object({
    building: z.string().trim().min(2).max(60),
    roomNumber: z.string().trim().min(2).max(40),
    capacity: z.coerce.number().int().min(1).max(1000),
    roomType: z.enum(['lecture', 'lab', 'seminar', 'auditorium']).default('lecture')
  }).strict()
};

export const createExamSchema = {
  body: z.object({
    offeringId: z.coerce.number().int().positive(),
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
    room: z.string().trim().min(2).max(60)
  }).strict().refine((b) => b.startTime < b.endTime, {
    message: 'endTime must be after startTime'
  })
};

export const createOfficeHourSlotSchema = {
  body: z.object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
    location: z.string().trim().min(2).max(120)
  }).strict().refine((b) => b.startTime < b.endTime, {
    message: 'endTime must be after startTime'
  })
};

export const bookOfficeHourSchema = {
  body: z.object({
    slotId: z.coerce.number().int().positive(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    topic: z.string().trim().min(3).max(240)
  }).strict()
};

export const submitEvaluationSchema = {
  body: z.object({
    offeringId: z.coerce.number().int().positive(),
    ratingTeaching: z.coerce.number().int().min(1).max(5),
    ratingContent: z.coerce.number().int().min(1).max(5),
    ratingFairness: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional()
  }).strict()
};

export const createCalendarEventSchema = {
  body: z.object({
    termId: z.coerce.number().int().positive().nullable().optional(),
    title: z.string().trim().min(2).max(160),
    eventType: z.enum(['registration', 'add_drop', 'withdrawal', 'exams', 'holiday', 'commencement']),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }).strict()
};
