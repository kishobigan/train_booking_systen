'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const AuthService = require('../../../src/modules/auth/auth.service');
const password = require('../../../src/lib/password');
function record(values) {
  return {
    ...values,
    toJSON() {
      const { passwordHash: ignored, ...safe } = this;
      void ignored;
      return safe;
    },
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
  };
}
test('temporary login is restricted and initial change issues normal tokens', async () => {
  const user = record({
    id: 'u-1',
    fullName: 'Staff',
    role: 'STAFF',
    isActive: true,
    mustChangePassword: true,
    passwordHash: await password.hash('Temporary@1234'),
  });
  const tokens = [];
  const service = new AuthService({
    userRepository: {
      async findForAuthentication() {
        return user;
      },
      async findByIdForAuthentication() {
        return user;
      },
    },
    refreshTokenRepository: {
      async create(value) {
        tokens.push(value);
      },
      async revokeAllForUser() {},
    },
    auditService: { async record() {} },
    transactionManager: {
      async execute(callback) {
        return callback({});
      },
    },
  });
  const login = await service.login({
    identifier: 'staff@example.com',
    password: 'Temporary@1234',
  });
  assert.equal(login.requiresPasswordChange, true);
  assert.equal(login.accessToken, undefined);
  const changed = await service.changeInitialPassword({
    token: login.passwordChangeToken,
    currentPassword: 'Temporary@1234',
    newPassword: 'Permanent@12345',
    confirmPassword: 'Permanent@12345',
  });
  assert.equal(user.mustChangePassword, false);
  assert.ok(changed.accessToken);
  assert.ok(changed.refreshToken);
  assert.equal(tokens.length, 1);
  assert.notEqual(tokens[0].tokenHash, changed.refreshToken);
  assert.equal(await password.verify('Temporary@1234', user.passwordHash), false);
});

test('normal login stores only a hash and refresh rotates with reuse detection', async () => {
  const user = record({
    id: 'u-2',
    fullName: 'Admin',
    role: 'ADMIN',
    isActive: true,
    mustChangePassword: false,
    passwordHash: await password.hash('Permanent@12345'),
  });
  const stored = [];
  let revokeAllCount = 0;
  const refreshTokenRepository = {
    async create(value) {
      stored.push({ ...value, revokedAt: null });
    },
    async findByIdForUpdate(id) {
      return stored.find((item) => item.id === id);
    },
    async revoke(id) {
      stored.find((item) => item.id === id).revokedAt = new Date();
    },
    async revokeAllForUser() {
      revokeAllCount += 1;
      stored.forEach((item) => {
        item.revokedAt ||= new Date();
      });
    },
  };
  const service = new AuthService({
    userRepository: {
      findForAuthentication: async () => user,
      findByIdForAuthentication: async () => user,
    },
    refreshTokenRepository,
    auditService: { record: async () => undefined },
    transactionManager: {
      execute: async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }),
    },
  });
  const login = await service.login({
    identifier: 'ADMIN@EXAMPLE.COM',
    password: 'Permanent@12345',
  });
  assert.notEqual(stored[0].tokenHash, login.refreshToken);
  const refreshed = await service.refreshAccessToken({ refreshToken: login.refreshToken });
  assert.ok(refreshed.accessToken);
  assert.notEqual(refreshed.refreshToken, login.refreshToken);
  assert.ok(stored[0].revokedAt);
  await assert.rejects(
    () => service.refreshAccessToken({ refreshToken: login.refreshToken }),
    (error) => error.code === 'INVALID_REFRESH_TOKEN'
  );
  assert.equal(revokeAllCount, 1);
});
