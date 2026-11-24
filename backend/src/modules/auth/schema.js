import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  }).strict()
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128)
  }).strict()
};
