'use strict';
module.exports = Object.freeze({
  enabled: process.env.SMS_ENABLED === 'true',
  provider: process.env.SMS_PROVIDER || 'MOCK',
  from: process.env.SMS_FROM || 'TRAIN',
  defaultCountryCode: process.env.SMS_DEFAULT_COUNTRY_CODE || null,
});
