'use strict';
const cron = require('node-cron');
const bool = (name, fallback = true) =>
  process.env[name] === undefined ? fallback : process.env[name] === 'true';
const positive = (name, fallback, { max = 10000 } = {}) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  return value;
};
const schedule = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (!cron.validate(value)) throw new Error(`${name} is not a valid cron expression`);
  return value;
};
const timezone = process.env.JOBS_TIMEZONE || 'Asia/Colombo';
try {
  new Intl.DateTimeFormat('en', { timeZone: timezone });
} catch {
  throw new Error('JOBS_TIMEZONE is not supported');
}
module.exports = Object.freeze({
  enabled: bool('JOBS_ENABLED'),
  timezone,
  lockTimeoutSeconds: positive('JOB_LOCK_TIMEOUT_SECONDS', 300),
  maxRecordFailures: positive('JOB_MAX_RECORD_FAILURES', 25),
  staleProcessingMinutes: positive('JOB_STALE_PROCESSING_MINUTES', 15),
  shutdownTimeoutSeconds: positive('JOB_SHUTDOWN_TIMEOUT_SECONDS', 30),
  healthPort: Number(process.env.JOB_HEALTH_PORT || 0),
  expireBookingHolds: {
    enabled: bool('EXPIRE_BOOKING_HOLDS_ENABLED'),
    cron: schedule('EXPIRE_BOOKING_HOLDS_CRON', '*/1 * * * *'),
    batchSize: positive('EXPIRE_BOOKING_HOLDS_BATCH_SIZE', 100, { max: 500 }),
    maxPerRun: positive('EXPIRE_BOOKING_HOLDS_MAX_PER_RUN', 1000),
  },
  expireWaitlistOffers: {
    enabled: bool('EXPIRE_WAITLIST_OFFERS_ENABLED'),
    cron: schedule('EXPIRE_WAITLIST_OFFERS_CRON', '*/1 * * * *'),
    batchSize: positive('EXPIRE_WAITLIST_OFFERS_BATCH_SIZE', 100, { max: 500 }),
    maxPerRun: positive('EXPIRE_WAITLIST_OFFERS_MAX_PER_RUN', 1000),
  },
  retryNotifications: {
    enabled: bool('RETRY_NOTIFICATIONS_ENABLED'),
    cron: schedule('RETRY_NOTIFICATIONS_CRON', '*/1 * * * *'),
    batchSize: positive('RETRY_NOTIFICATIONS_BATCH_SIZE', 100, { max: 500 }),
    concurrency: positive('NOTIFICATION_JOB_CONCURRENCY', 5, { max: 20 }),
  },
  reconcilePayments: {
    enabled: bool('PAYMENT_RECONCILIATION_ENABLED'),
    cron: schedule('PAYMENT_RECONCILIATION_CRON', '*/10 * * * *'),
    batchSize: positive('PAYMENT_RECONCILIATION_BATCH_SIZE', 50, { max: 200 }),
    maxPerRun: positive('PAYMENT_RECONCILIATION_MAX_PER_RUN', 200),
    concurrency: positive('PAYMENT_RECONCILIATION_CONCURRENCY', 4, { max: 10 }),
    minAgeMinutes: positive('PAYMENT_RECONCILIATION_MIN_AGE_MINUTES', 5),
    maxAgeDays: positive('PAYMENT_RECONCILIATION_MAX_AGE_DAYS', 30),
  },
});
