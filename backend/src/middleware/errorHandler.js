import { AppError, mapPgError } from '../utils/errors.js';
import { logError } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: []
    }
  });
}

export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON request body',
        details: []
      }
    });
  }

  const mapped = mapPgError(err);
  if (mapped) {
    return res.status(mapped.status).json({
      error: {
        code: mapped.code,
        message: mapped.message,
        details: mapped.details || []
      }
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || []
      }
    });
  }

  logError('unhandled.error', err, { requestId: req.id, method: req.method, path: req.originalUrl });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred',
      details: []
    }
  });
}
