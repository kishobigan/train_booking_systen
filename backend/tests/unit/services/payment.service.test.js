'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.BANK_PAYMENT_ENABLED = 'true';
const assert = require('node:assert/strict');
const test = require('node:test');
const PaymentService = require('../../../src/modules/payments/payment.service');
function record(values) {
  return {
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
  };
}
function fixture() {
  const booking = {
    id: 'b-1',
    userId: 'u-1',
    bookingReference: 'TRN-ABC123',
    status: 'HELD',
    totalAmount: '817.95',
    currency: 'LKR',
    holdExpiresAt: new Date(Date.now() + 60000),
  };
  const payments = [];
  let stripeRequest;
  const service = new PaymentService({
    paymentRepository: {
      async findSuccessfulByBookingId() {
        return null;
      },
      async findActiveAttemptByBookingId() {
        return null;
      },
      async create(values) {
        const payment = record({ id: 'p-1', ...values });
        payments.push(payment);
        return payment;
      },
      async markFailed(payment, values) {
        return payment.update({ status: 'FAILED', ...values });
      },
    },
    bookingRepository: {
      async findByIdForUpdate() {
        return booking;
      },
      async findById() {
        return booking;
      },
    },
    stripePaymentService: {
      async createPaymentIntent(input) {
        stripeRequest = input;
        return { id: 'pi_1', status: 'requires_payment_method', client_secret: 'pi_1_secret_safe' };
      },
    },
    transactionManager: {
      async executeSerializable(callback) {
        return callback({ LOCK: { UPDATE: 'UPDATE' } });
      },
    },
    idempotencyService: {
      async begin() {
        return null;
      },
      async complete() {},
    },
    auditService: { async record() {} },
  });
  return { service, booking, payments, stripeRequest: () => stripeRequest };
}
test('creates Stripe payment from server-owned booking totals', async () => {
  const data = fixture();
  const result = await data.service.createPayment({
    bookingId: 'b-1',
    method: 'CARD',
    userId: 'u-1',
    role: 'PASSENGER',
  });
  assert.equal(data.payments[0].amount, '817.95');
  assert.equal(data.payments[0].currency, 'LKR');
  assert.equal(data.stripeRequest().booking, data.booking);
  assert.equal(result.status, 'PROCESSING');
  assert.equal(result.stripe.paymentIntentId, 'pi_1');
});
test('rejects payment access by another passenger', async () => {
  const data = fixture();
  assert.throws(() =>
    data.service.verifyPaymentOwnership(data.booking, { id: 'other', role: 'PASSENGER' })
  );
});
