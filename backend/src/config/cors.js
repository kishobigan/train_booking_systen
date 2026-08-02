'use strict';
const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
module.exports = Object.freeze({
  credentials: true,
  origin: configuredOrigins.length
    ? (origin, callback) =>
        callback(
          origin && !configuredOrigins.includes(origin) ? new Error('Origin is not allowed') : null,
          true
        )
    : true,
});
