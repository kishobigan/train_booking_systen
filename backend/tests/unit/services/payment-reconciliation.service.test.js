'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const PaymentReconciliationService = require('../../../src/modules/payments/payment-reconciliation.service');
test('flags provider amount mismatch without marking payment paid', async () => {
  const payment = {
    id: 'p',
    providerReference: 'pi',
    providerName: 'STRIPE',
    status: 'PROCESSING',
    amount: '10.00',
    currency: 'LKR',
  };
  let log;
  const service = new PaymentReconciliationService({
    stripePaymentService: {
      async retrievePaymentIntent() {
        return { status: 'succeeded', amount: 1, currency: 'lkr' };
      },
    },
    reconciliationRepository: {
      async create(value) {
        log = value;
        return value;
      },
    },
  });
  await service.reconcileStripePayment({ payment });
  assert.equal(log.result, 'MANUAL_REVIEW');
  assert.equal(log.differenceType, 'AMOUNT_MISMATCH');
  assert.equal(payment.status, 'PROCESSING');
});
