import { env } from '../../config/env.js';
import * as service from './service.js';

export const REFRESH_COOKIE_NAME = 'usms_refresh';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth'
  });
}

export async function login(req, res, next) {
  try {
    const result = await service.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.json({
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await service.refresh(rawToken);
    setRefreshCookie(res, result.refreshToken);
    res.json({
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    await service.logout(rawToken);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await service.getMe(req.user.id);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await service.changePassword(req.user.id, req.body);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
