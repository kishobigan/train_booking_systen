'use strict';

class BootstrapApiError extends Error {
  constructor(message, { status, code, path, details } = {}) {
    super(message);
    this.name = 'BootstrapApiError';
    Object.assign(this, { status, code, path, details });
  }
}

class BootstrapClient {
  constructor(config, state) {
    Object.assign(this, { config, state });
  }
  async request(path, { method = 'GET', body, authenticated = true, idempotencyKey, headers = {} } = {}) {
    const controller = new globalThis.AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await globalThis.fetch(`${this.config.apiBaseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(body !== undefined && { 'content-type': 'application/json' }),
          ...(authenticated && this.state.accessToken && { authorization: `Bearer ${this.state.accessToken}` }),
          ...(this.state.cookie && { cookie: this.state.cookie }),
          ...(idempotencyKey && { 'idempotency-key': idempotencyKey }),
          ...headers,
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) this.state.cookie = setCookie.split(';', 1)[0];
      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        const error = payload?.error || {};
        throw new BootstrapApiError(error.message || `API request failed with ${response.status}`, {
          status: response.status,
          code: error.code,
          path,
          details: error.details,
        });
      }
      return payload?.data ?? payload;
    } finally {
      clearTimeout(timer);
    }
  }
  get(path) { return this.request(path); }
  post(path, body, idempotencyKey) { return this.request(path, { method: 'POST', body, idempotencyKey }); }
  patch(path, body) { return this.request(path, { method: 'PATCH', body }); }
  async login(identifier, password) {
    const data = await this.request('/auth/login', { method: 'POST', authenticated: false, body: { identifier, password } });
    if (data.requiresPasswordChange) throw new BootstrapApiError('Bootstrap Super Admin requires a password change', { code: 'PASSWORD_CHANGE_REQUIRED' });
    this.state.accessToken = data.accessToken;
    return data;
  }
}

module.exports = { BootstrapClient, BootstrapApiError };
