import { z } from 'zod';
import { VALID_GRADE_LETTERS } from '../../utils/grades.js';

const gradeLetterEnum = z.enum(VALID_GRADE_LETTERS);

export const setSingleGradeSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    gradeLetter: gradeLetterEnum
  }).strict()
};

export const bulkGradesSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    grades: z.array(
      z.object({
        enrollmentId: z.coerce.number().int().positive(),
        gradeLetter: gradeLetterEnum
      }).strict()
    ).min(1).max(200)
  }).strict()
};
