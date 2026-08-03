'use strict';
module.exports = Object.freeze({
  nicRequiredAge: Number(process.env.PASSENGER_NIC_REQUIRED_AGE || 16),
  hmacSecret: process.env.PASSENGER_IDENTITY_HMAC_SECRET || 'development-passenger-hmac-secret',
  encryptionKey:
    process.env.PASSENGER_IDENTITY_ENCRYPTION_KEY || 'development-passenger-encryption-key',
});
