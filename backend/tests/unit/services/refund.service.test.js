'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const RefundService = require('../../../src/modules/refunds/refund.service');
const RefundError = require('../../../src/common/errors/RefundError');
function fixture(refunded = '200.00') {
  return new RefundService({
    refundRepository: {
      async sumSuccessfulRefunds() {
        return refunded;
      },
      async findPendingRefunds() {
        return [];
      },
    },
    accessControlService: {
      async assertAdminJourneyAccess() {
        return true;
      },
    },
  });
}
test('calculates decimal-safe remaining refundable balance', async () => {
  const result = await fixture().validateRefundEligibility({
    payment: { id: 'p', status: 'PARTIALLY_REFUNDED', amount: '817.95' },
    booking: { journeyId: 'j' },
    requestedAmount: '617.95',
    actor: { id: 'a', role: 'ADMIN' },
  });
  assert.equal(result.remaining, '617.95');
  assert.equal(result.full, true);
});
test('rejects refund beyond remaining balance', async () => {
  await assert.rejects(
    () =>
      fixture().validateRefundEligibility({
        payment: { id: 'p', status: 'PAID', amount: '817.95' },
        booking: { journeyId: 'j' },
        requestedAmount: '617.96',
        actor: { role: 'SUPER_ADMIN' },
      }),
    RefundError
  );
});
