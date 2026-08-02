'use strict';
require('dotenv').config();
const sequelize = require('../src/database/sequelize');
const { User } = require('../src/models');
const password = require('../src/lib/password');
async function main() {
  const fullName = process.env.SUPER_ADMIN_NAME;
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const plainPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!fullName || !email || !plainPassword)
    throw new Error('SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
  if (await User.findOne({ where: { email } }))
    throw new Error('A user with that email already exists');
  await User.create({
    fullName,
    email,
    passwordHash: await password.hash(plainPassword),
    role: 'SUPER_ADMIN',
    isActive: true,
    mustChangePassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 3600000),
  });
  process.stdout.write(`Super admin created for ${email}; initial password change is required.\n`);
}
main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
