let accessToken = null;
let refreshPromise = null;
let onUnauthorizedCallback = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setOnUnauthorized(cb) {
  onUnauthorizedCallback = cb;
}

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const json = await parseJsonSafe(res);
        const token = json?.data?.accessToken || null;
        accessToken = token;
        return json?.data || null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}, { retryOn401 = true } = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (path.startsWith('/auth/')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });

  if (res.status === 401 && retryOn401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const refreshed = await refreshSession();
    if (refreshed?.accessToken) {
      return apiRequest(path, options, { retryOn401: false });
    }
    if (onUnauthorizedCallback) onUnauthorizedCallback();
  }

  if (res.status === 204) {
    return null;
  }

  const json = await parseJsonSafe(res);
  if (!res.ok) {
    const err = json?.error || {};
    throw new ApiError(
      res.status,
      err.code || 'HTTP_ERROR',
      err.message || `Request failed (${res.status})`,
      err.details || []
    );
  }

  return json;
}

export async function downloadPdf(path, filename, { retryOn401 = true } = {}) {
  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers
  });

  if (res.status === 401 && retryOn401) {
    const refreshed = await refreshSession();
    if (refreshed?.accessToken) {
      return downloadPdf(path, filename, { retryOn401: false });
    }
    if (onUnauthorizedCallback) onUnauthorizedCallback();
  }

  if (!res.ok) {
    const json = await parseJsonSafe(res);
    throw new ApiError(res.status, json?.error?.code || 'HTTP_ERROR', json?.error?.message || 'Download failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
