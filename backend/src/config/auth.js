'use strict';
const required = (name, fallback) => process.env[name] || fallback;
module.exports = Object.freeze({
  jwtSecret: required(
    'JWT_SECRET',
    process.env.NODE_ENV === 'test' ? 'test-secret-change-me' : undefined
  ),
  accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900),
  refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 2592000),
  passwordChangeTtlSeconds: Number(process.env.PASSWORD_CHANGE_TOKEN_TTL_SECONDS || 900),
  temporaryPasswordTtlHours: Number(process.env.TEMPORARY_PASSWORD_TTL_HOURS || 24),
});
