'use strict';

const USER_ROLE = require('../../common/constants/user-role.constants');
const { validatePassword } = require('../../lib/password');

const DEV_USERS = [
  [
    'SUPER_ADMIN',
    'System Super Admin',
    'superadmin@railway.local',
    '+94770000001',
    'SuperAdmin@12345',
  ],
  ['ADMIN', 'Journey Administrator', 'admin@railway.local', '+94770000002', 'Admin@12345'],
  ['STAFF', 'Colombo Fort Station Staff', 'staff@railway.local', '+94770000003', 'Staff@12345'],
];

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (!['true', 'false'].includes(value.toLowerCase()))
    throw new Error(`${name} must be true or false`);
  return value.toLowerCase() === 'true';
}

function loadSeedConfig() {
  const environment = process.env.NODE_ENV || 'development';
  if (!['development', 'test'].includes(environment) && !bool('ALLOW_DATABASE_SEED')) {
    throw new Error(
      'Database seeding is disabled in this environment. Set ALLOW_DATABASE_SEED=true to override.'
    );
  }

  const users = DEV_USERS.map(
    ([role, defaultName, defaultEmail, defaultPhone, defaultPassword]) => {
      const prefix = `SEED_${role}`;
      const password = process.env[`${prefix}_PASSWORD`] || defaultPassword;
      validatePassword(password);
      return {
        role: USER_ROLE[role],
        fullName: process.env[`${prefix}_NAME`] || defaultName,
        email: (process.env[`${prefix}_EMAIL`] || defaultEmail).trim().toLowerCase(),
        phoneNumber: process.env[`${prefix}_PHONE`] || defaultPhone,
        password,
      };
    }
  );

  const timeZone = process.env.SEED_TIMEZONE || 'Asia/Colombo';
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
  } catch {
    throw new Error(`Invalid SEED_TIMEZONE: ${timeZone}`);
  }

  return {
    users,
    timeZone,
    resetPasswords: bool('SEED_RESET_PASSWORDS'),
    mustChangePassword: bool('SEED_USERS_MUST_CHANGE_PASSWORD'),
    staffStationCodes: (process.env.SEED_STAFF_STATION_CODES || 'FOT')
      .split(',')
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean),
  };
}

module.exports = { loadSeedConfig };
