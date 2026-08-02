'use strict';
module.exports = Object.freeze({
  enabled: process.env.EMAIL_ENABLED === 'true',
  provider: process.env.EMAIL_PROVIDER || 'SMTP',
  smtp: Object.freeze({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  }),
  fromName: process.env.EMAIL_FROM_NAME || 'Train Booking System',
  fromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@example.com',
  replyTo: process.env.EMAIL_REPLY_TO || undefined,
});
