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
