import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken({ userId, role }) {
  return jwt.sign(
    { sub: String(userId), role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

export function generateFamilyId() {
  return crypto.randomUUID();
}
