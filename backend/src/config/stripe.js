'use strict';
module.exports = Object.freeze({
  enabled: process.env.STRIPE_ENABLED === 'true',
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  currency: (process.env.STRIPE_CURRENCY || 'lkr').toLowerCase(),
  apiVersion: process.env.STRIPE_API_VERSION || undefined,
});
