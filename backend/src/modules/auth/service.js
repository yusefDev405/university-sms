import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import {
  generateFamilyId,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken
} from '../../utils/tokens.js';
import * as repo from './repository.js';

function refreshExpiryDate() {
  return new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

export async function login({ email, password }) {
  const user = await repo.findUserByEmail(email);
  // Uniform error message regardless of whether email exists or password mismatches
  if (!user || !user.is_active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed sign-in attempts. Please try again later.');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await repo.recordFailedLogin(user.id);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await repo.resetFailedLogins(user.id);

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const rawRefreshToken = generateRefreshToken();
  const familyId = generateFamilyId();
  await repo.insertRefreshToken({
    userId: user.id,
    familyId,
    tokenHash: hashRefreshToken(rawRefreshToken),
    expiresAt: refreshExpiryDate()
  });

  const me = await repo.findUserWithProfileById(user.id);
  return { accessToken, refreshToken: rawRefreshToken, user: me };
}

export async function refresh(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new AppError(401, 'REFRESH_MISSING', 'Refresh token is required');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const existing = await repo.findRefreshTokenByHash(tokenHash);
  if (!existing) {
    throw new AppError(401, 'REFRESH_INVALID', 'Invalid refresh token');
  }

  // Reuse detection: if a previously rotated/revoked token is replayed, revoke the entire token family
  if (existing.revoked_at) {
    await repo.revokeTokenFamily(existing.family_id);
    throw new AppError(401, 'REFRESH_REUSED', 'Refresh token reuse detected; please sign in again');
  }

  if (new Date(existing.expires_at).getTime() <= Date.now()) {
    await repo.revokeRefreshTokenByHash(tokenHash);
    throw new AppError(401, 'REFRESH_EXPIRED', 'Refresh token expired');
  }

  if (!existing.is_active) {
    await repo.revokeTokenFamily(existing.family_id);
    throw new AppError(401, 'UNAUTHORIZED', 'Account is inactive');
  }

  const newRawRefresh = generateRefreshToken();
  await repo.rotateRefreshToken({
    oldTokenId: existing.id,
    userId: existing.user_id,
    familyId: existing.family_id,
    newTokenHash: hashRefreshToken(newRawRefresh),
    expiresAt: refreshExpiryDate()
  });

  const accessToken = signAccessToken({ userId: existing.user_id, role: existing.role });
  const user = await repo.findUserWithProfileById(existing.user_id);

  return { accessToken, refreshToken: newRawRefresh, user };
}

export async function logout(rawRefreshToken) {
  if (rawRefreshToken) {
    await repo.revokeRefreshTokenByHash(hashRefreshToken(rawRefreshToken));
  }
}

export async function getMe(userId) {
  const me = await repo.findUserWithProfileById(userId);
  if (!me) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return me;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const existingHash = await repo.getUserPasswordHash(userId);
  if (!existingHash) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const matches = await bcrypt.compare(currentPassword, existingHash);
  if (!matches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  const rounds = env.NODE_ENV === 'test' ? 6 : 12;
  const newHash = await bcrypt.hash(newPassword, rounds);
  await repo.updateUserPasswordHash(userId, newHash);
}
