import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
    totpCode: z.string().trim().regex(/^\d{6}$/).optional()
  }).strict()
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128)
  }).strict()
};

export const totpVerifySchema = {
  body: z.object({
    code: z.string().trim().regex(/^\d{6}$/)
  }).strict()
};

export const totpDisableSchema = {
  body: z.object({
    password: z.string().min(1)
  }).strict()
};
