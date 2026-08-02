'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const StripeWebhookService = require('../../../src/modules/payments/stripe-webhook.service');
const PaymentAmountMismatchError = require('../../../src/common/errors/PaymentAmountMismatchError');
function payment() {
  return {
    id: 'p-1',
    bookingId: 'b-1',
    providerName: 'STRIPE',
    providerReference: 'pi_1',
    amount: '817.95',
    currency: 'LKR',
    status: 'PROCESSING',
    async update(v) {
      Object.assign(this, v);
      return this;
    },
  };
}
test('validates provider amount and confirms successful payment once', async () => {
  const row = payment();
  let confirmations = 0;
  const service = new StripeWebhookService({
    paymentRepository: {
      async findByProviderReferenceForUpdate() {
        return row;
      },
    },
    paymentService: {
      async markPaid(p, values) {
        return p.update({ status: 'PAID', ...values });
      },
      async completePaidBooking() {
        confirmations += 1;
      },
    },
    auditService: { async record() {} },
  });
  await service.handlePaymentIntentSucceeded({
    intent: {
      id: 'pi_1',
      status: 'succeeded',
      amount: 81795,
      amount_received: 81795,
      currency: 'lkr',
    },
    transaction: {},
  });
  assert.equal(row.status, 'PAID');
  assert.equal(confirmations, 1);
  await service.handlePaymentIntentSucceeded({
    intent: { id: 'pi_1', amount: 81795, amount_received: 81795, currency: 'lkr' },
    transaction: {},
  });
  assert.equal(confirmations, 1);
});
test('rejects Stripe amount mismatch', async () => {
  const row = payment();
  const service = new StripeWebhookService({
    paymentRepository: {
      async findByProviderReferenceForUpdate() {
        return row;
      },
    },
  });
  await assert.rejects(
    () =>
      service.handlePaymentIntentSucceeded({
        intent: { id: 'pi_1', amount: 1, amount_received: 1, currency: 'lkr' },
        transaction: {},
      }),
    PaymentAmountMismatchError
  );
});
