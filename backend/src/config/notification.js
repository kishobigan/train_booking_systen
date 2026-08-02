'use strict';
const CHANNEL = require('../common/constants/notification-channel.constants');
const email = require('./email');
const sms = require('./sms');
const channels = Object.freeze([CHANNEL.EMAIL, CHANNEL.SMS]);
module.exports = Object.freeze({
  enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
  maxAttempts: Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5),
  retryBaseMinutes: Number(process.env.NOTIFICATION_RETRY_BASE_MINUTES || 2),
  retryMaxMinutes: Number(process.env.NOTIFICATION_RETRY_MAX_MINUTES || 60),
  batchSize: Math.min(Math.max(Number(process.env.NOTIFICATION_BATCH_SIZE || 100), 1), 500),
  processingTimeoutMinutes: Number(process.env.NOTIFICATION_PROCESSING_TIMEOUT_MINUTES || 10),
  channelEnabled: Object.freeze({ [CHANNEL.EMAIL]: email.enabled, [CHANNEL.SMS]: sms.enabled }),
  retentionDays: Number(process.env.NOTIFICATION_RETENTION_DAYS || 90),
  defaultChannels: Object.freeze({
    bookingConfirmation: channels,
    bookingCancellation: channels,
    waitlistOffer: channels,
    paymentSuccess: Object.freeze([CHANNEL.EMAIL]),
    journeyDelay: channels,
  }),
});
