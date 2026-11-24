const REDACT_KEYS = new Set([
  'password',
  'password_hash',
  'currentPassword',
  'newPassword',
  'authorization',
  'cookie',
  'refreshToken',
  'token'
]);

export function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k) || REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function logInfo(event, meta = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.log(
    JSON.stringify({
      level: 'info',
      ts: new Date().toISOString(),
      event,
      ...redact(meta)
    })
  );
}

export function logError(event, err, meta = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.error(
    JSON.stringify({
      level: 'error',
      ts: new Date().toISOString(),
      event,
      message: err?.message || String(err),
      code: err?.code,
      ...redact(meta)
    })
  );
}
