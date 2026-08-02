'use strict';
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const AuthController = require('../../../src/modules/auth/auth.controller');
const authConfig = require('../../../src/config/auth');
function response() {
  return {
    statusCode: 200,
    cookies: [],
    cleared: [],
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
    },
    clearCookie(name, options) {
      this.cleared.push({ name, options });
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send() {
      return this;
    },
  };
}
function request({ body = {}, headers = {}, user } = {}) {
  return {
    body,
    user,
    ip: '127.0.0.1',
    id: 'request-1',
    get(name) {
      return headers[name.toLowerCase()] || '';
    },
  };
}
async function invoke(handler, req, res) {
  let error;
  await handler(req, res, (value) => {
    error = value;
  });
  if (error) throw error;
}
const user = {
  id: 'u-1',
  fullName: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
  isActive: true,
  mustChangePassword: false,
};
test('normal login returns safe data and sets the refresh cookie', async () => {
  const controller = new AuthController({
    authConfig,
    authService: {
      login: async () => ({
        requiresPasswordChange: false,
        user,
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
      }),
    },
  });
  const res = response();
  await invoke(
    controller.login,
    request({ body: { identifier: user.email, password: 'StrongPassword@123' } }),
    res
  );
  assert.equal(res.body.data.accessToken, 'access');
  assert.equal(res.body.data.refreshToken, undefined);
  assert.equal(res.cookies[0].options.httpOnly, true);
});
test('first login returns only a restricted password-change token', async () => {
  const controller = new AuthController({
    authConfig,
    authService: {
      login: async () => ({
        requiresPasswordChange: true,
        passwordChangeToken: 'restricted',
        user: { ...user, mustChangePassword: true },
      }),
    },
  });
  const res = response();
  await invoke(
    controller.login,
    request({ body: { identifier: user.email, password: 'StrongPassword@123' } }),
    res
  );
  assert.equal(res.body.data.passwordChangeToken, 'restricted');
  assert.equal(res.cookies.length, 0);
});
test('refresh rotates cookie and logout clears it', async () => {
  const authService = {
    refreshAccessToken: async ({ refreshToken }) => {
      assert.equal(refreshToken, 'old');
      return { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 };
    },
    logout: async () => true,
  };
  const controller = new AuthController({ authConfig, authService });
  const res = response();
  await invoke(
    controller.refresh,
    request({ headers: { cookie: `${authConfig.cookie.name}=old` } }),
    res
  );
  assert.equal(res.cookies[0].value, 'new-refresh');
  await invoke(
    controller.logout,
    request({ headers: { cookie: `${authConfig.cookie.name}=new-refresh` } }),
    res
  );
  assert.equal(res.statusCode, 204);
  assert.equal(res.cleared.length, 1);
});
test('logout-all and me use the authenticated database user', async () => {
  const calls = [];
  const controller = new AuthController({
    authConfig,
    authService: { logoutAll: async (id) => calls.push(id), getCurrentUser: async () => user },
  });
  const res = response();
  await invoke(controller.logoutAll, request({ user }), res);
  assert.deepEqual(calls, ['u-1']);
  await invoke(controller.getCurrentUser, request({ user }), res);
  assert.equal(res.body.data.email, user.email);
  assert.equal(res.body.data.passwordHash, undefined);
});
