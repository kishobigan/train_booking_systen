'use strict';
const PaymentError = require('./PaymentError');
class StripeWebhookError extends PaymentError {
  constructor(message = 'Invalid Stripe webhook') {
    super(message);
    this.code = 'STRIPE_WEBHOOK_ERROR';
  }
}
module.exports = StripeWebhookError;
