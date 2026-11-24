import crypto from 'node:crypto';
import { logInfo } from '../utils/logger.js';

export function requestIdMiddleware(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = String(id);
  res.setHeader('X-Request-Id', req.id);
  const start = performance.now();

  res.on('finish', () => {
    logInfo('http.request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number((performance.now() - start).toFixed(1)),
      userId: req.user?.id ?? null
    });
  });

  next();
}
