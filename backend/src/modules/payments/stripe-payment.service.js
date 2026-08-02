'use strict';
const getStripe = require('../../lib/stripe');
const { toMinorUnits } = require('../../common/utils/money');
const PaymentVerificationError = require('../../common/errors/PaymentVerificationError');
class StripePaymentService {
  constructor(stripeFactory = getStripe) {
    this.stripeFactory = stripeFactory;
  }
  createPaymentIntent({ payment, booking }) {
    return this.stripeFactory().paymentIntents.create(
      {
        amount: toMinorUnits(payment.amount, payment.currency),
        currency: payment.currency.toLowerCase(),
        metadata: {
          paymentId: payment.id,
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          paymentReference: payment.paymentReference,
        },
        description: `Train booking ${booking.bookingReference}`,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: `create-payment-intent:${payment.id}` }
    );
  }
  retrievePaymentIntent(providerReference) {
    return this.stripeFactory().paymentIntents.retrieve(providerReference);
  }
  constructWebhookEvent(rawBody, signature, secret) {
    try {
      return this.stripeFactory().webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new PaymentVerificationError('Invalid Stripe webhook signature');
    }
  }
  createRefund({ refund, payment }) {
    return this.stripeFactory().refunds.create(
      {
        payment_intent: payment.providerReference,
        amount: toMinorUnits(refund.amount, payment.currency),
        metadata: { refundId: refund.id, paymentId: payment.id, bookingId: payment.bookingId },
      },
      { idempotencyKey: `create-refund:${refund.id}` }
    );
  }
}
module.exports = StripePaymentService;
