import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import {
  generateFamilyId,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken
} from '../../utils/tokens.js';
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from '../../utils/totp.js';
import * as repo from './repository.js';

function refreshExpiryDate() {
  return new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

export async function login({ email, password, totpCode, userAgent = null, ipAddress = null }) {
  const user = await repo.findUserByEmail(email);
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

  if (user.totp_enabled) {
    if (!totpCode) {
      throw new AppError(401, 'TOTP_REQUIRED', 'Two-factor authentication code required');
    }
    if (!verifyTotpCode(user.totp_secret, totpCode)) {
      throw new AppError(401, 'INVALID_TOTP', 'Invalid two-factor authentication code');
    }
  }

  await repo.resetFailedLogins(user.id);

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const rawRefreshToken = generateRefreshToken();
  const familyId = generateFamilyId();
  await repo.insertRefreshToken({
    userId: user.id,
    familyId,
    tokenHash: hashRefreshToken(rawRefreshToken),
    expiresAt: refreshExpiryDate(),
    userAgent,
    ipAddress
  });

  const me = await repo.findUserWithProfileById(user.id);
  return { accessToken, refreshToken: rawRefreshToken, user: me };
}

export async function refresh(rawRefreshToken, { userAgent = null, ipAddress = null } = {}) {
  if (!rawRefreshToken) {
    throw new AppError(401, 'REFRESH_MISSING', 'Refresh token is required');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const existing = await repo.findRefreshTokenByHash(tokenHash);
  if (!existing) {
    throw new AppError(401, 'REFRESH_INVALID', 'Invalid refresh token');
  }

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
    expiresAt: refreshExpiryDate(),
    userAgent,
    ipAddress
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

export async function listActiveSessions(userId, rawRefreshToken) {
  let currentFamilyId = null;
  if (rawRefreshToken) {
    const existing = await repo.findRefreshTokenByHash(hashRefreshToken(rawRefreshToken));
    if (existing && Number(existing.user_id) === Number(userId)) {
      currentFamilyId = existing.family_id;
    }
  }
  const sessions = await repo.listActiveSessions(userId);
  return sessions.map((s) => ({
    ...s,
    is_current: currentFamilyId !== null && s.family_id === currentFamilyId
  }));
}

export async function revokeOtherSessions(userId, rawRefreshToken) {
  let currentFamilyId = null;
  if (rawRefreshToken) {
    const existing = await repo.findRefreshTokenByHash(hashRefreshToken(rawRefreshToken));
    if (existing && Number(existing.user_id) === Number(userId)) {
      currentFamilyId = existing.family_id;
    }
  }
  const revokedCount = await repo.revokeOtherSessions(userId, currentFamilyId);
  return { revokedCount };
}

export async function setupTotp(userId) {
  const user = await repo.findUserSecurityById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  const secret = generateTotpSecret();
  await repo.saveTotpSecret(userId, secret);
  return {
    secret,
    otpauthUri: buildOtpAuthUri({ email: user.email, secret })
  };
}

export async function enableTotp(userId, code) {
  const user = await repo.findUserSecurityById(userId);
  if (!user || !user.totp_secret) {
    throw new AppError(400, 'TOTP_NOT_INITIALIZED', 'Initialize 2FA setup first');
  }
  if (!verifyTotpCode(user.totp_secret, code)) {
    throw new AppError(400, 'INVALID_TOTP', 'Verification code did not match');
  }
  await repo.enableTotp(userId);
  return { totpEnabled: true };
}

export async function disableTotp(userId, password) {
  const user = await repo.findUserSecurityById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect password');
  }
  await repo.disableTotp(userId);
  return { totpEnabled: false };
}
