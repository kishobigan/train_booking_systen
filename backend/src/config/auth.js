'use strict';
const required = (name, fallback) => process.env[name] || fallback;
const testSecret = process.env.NODE_ENV === 'test' ? 'test-secret-change-me' : undefined;
const accessSecret = required('ACCESS_TOKEN_SECRET', required('JWT_SECRET', testSecret));
const refreshSecret = required('REFRESH_TOKEN_SECRET', required('JWT_REFRESH_SECRET', testSecret));
module.exports = Object.freeze({
  jwtSecret: accessSecret,
  accessSecret,
  refreshSecret,
  passwordChangeSecret: required('PASSWORD_CHANGE_TOKEN_SECRET', accessSecret),
  issuer: process.env.JWT_ISSUER || 'segment-train-booking-api',
  audience: process.env.JWT_AUDIENCE || 'segment-train-booking-client',
  accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900),
  refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 2592000),
  passwordChangeTtlSeconds: Number(process.env.PASSWORD_CHANGE_TOKEN_TTL_SECONDS || 900),
  temporaryPasswordTtlHours: Number(process.env.TEMPORARY_PASSWORD_TTL_HOURS || 24),
  cookie: Object.freeze({
    name: process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token',
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: process.env.AUTH_COOKIE_SAME_SITE || 'strict',
    path: '/api/v1/auth',
  }),
  refreshTokenLifetimeMs: Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 2592000) * 1000,
});
