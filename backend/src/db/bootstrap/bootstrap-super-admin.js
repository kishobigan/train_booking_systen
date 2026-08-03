'use strict';

const sequelize = require('../../database/sequelize');
const { User } = require('../../models');
const password = require('../../lib/password');
const { loadBootstrapConfig } = require('./bootstrap.config');

async function bootstrapSuperAdmin(config = loadBootstrapConfig()) {
  const definition = config.users.find((user) => user.role === 'SUPER_ADMIN');
  const UserModel = User.unscoped();
  let user = await UserModel.findOne({ where: { email: definition.email }, paranoid: false });
  if (!user) {
    user = await UserModel.create({
      fullName: definition.fullName,
      email: definition.email,
      phoneNumber: definition.phoneNumber,
      passwordHash: await password.hash(definition.password),
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: false,
      emailVerifiedAt: new Date(),
    });
    return { user, created: true };
  }
  if (user.deletedAt) await user.restore();
  const changes = { role: 'SUPER_ADMIN', isActive: true, blockedAt: null, blockedReason: null };
  if (config.resetPasswords) changes.passwordHash = await password.hash(definition.password);
  await user.update(changes);
  return { user, created: false };
}

async function main() {
  const result = await bootstrapSuperAdmin();
  process.stdout.write(`[bootstrap] Super Admin ${result.created ? 'created' : 'verified'} (${result.user.email})\n`);
}

if (require.main === module) main().catch((error) => { process.stderr.write(`[bootstrap:super-admin] ${error.message}\n`); process.exitCode = 1; }).finally(() => sequelize.close());

module.exports = { bootstrapSuperAdmin };
