'use strict';

const timeZone = process.env.RAILWAY_TIMEZONE || process.env.JOBS_TIMEZONE || 'Asia/Colombo';

try {
  new Intl.DateTimeFormat('en', { timeZone });
} catch {
  throw new Error(`Invalid time zone: ${timeZone}`);
}

module.exports = Object.freeze({ timeZone });