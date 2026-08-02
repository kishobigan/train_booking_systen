'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const BookingStatusService = require('../../../src/modules/bookings/booking-status.service');
const BookingStatusError = require('../../../src/common/errors/BookingStatusError');
const BookingExpiredError = require('../../../src/common/errors/BookingExpiredError');

function fixture(
  status = 'HELD',
  { paid = true, refunded = true, journeyStatus = 'DEPARTED' } = {}
) {
  const history = [];
  const effects = { seatStatuses: [], allocationUpdates: [], allocationDeletes: 0 };
  const booking = {
    id: 'booking-1',
    userId: 'user-1',
    status,
    holdExpiresAt: new Date('2026-08-01T00:15:00Z'),
    journey: { status: journeyStatus },
    async update(values) {
      Object.assign(this, values);
      return this;
    },
  };
  const service = new BookingStatusService({
    bookingRepository: {
      async findById() {
        return booking;
      },
    },
    bookingStatusRepository: {
      async findBookingForUpdate() {
        return booking;
      },
      async updateBookingStatus(item, values) {
        return item.update(values);
      },
      async updateBookingSeatStatuses(repository, id, next) {
        effects.seatStatuses.push(next);
      },
      async createStatusHistory(values) {
        history.push({ ...values, createdAt: new Date('2026-08-01T00:00:00Z') });
        return values;
      },
      async getStatusHistory() {
        return history;
      },
    },
    bookingSeatRepository: {},
    allocationRepository: {
      async updateByBooking(id, values) {
        effects.allocationUpdates.push(values);
      },
      async deleteByBooking() {
        effects.allocationDeletes += 1;
      },
    },
    paymentRepository: {
      async findSuccessfulByBooking() {
        return paid ? { id: 'payment-1' } : null;
      },
    },
    refundRepository: {
      async findSuccessfulByBooking() {
        return refunded ? { id: 'refund-1' } : null;
      },
    },
    transactionManager: {
      async transaction(callback) {
        return callback({
          LOCK: { UPDATE: 'UPDATE' },
          afterCommit(callbackAfterCommit) {
            callbackAfterCommit();
          },
        });
      },
    },
    clock: () => new Date('2026-08-01T00:00:00Z'),
  });
  return { service, booking, history, effects };
}
const admin = { type: 'USER', userId: 'admin-1', role: 'ADMIN' };
const system = { type: 'SYSTEM', source: 'job' };

test('exposes only explicit allowed transitions and rejects invalid or identical transitions', async () => {
  const { service } = fixture();
  assert.deepEqual(service.getAllowedTransitions('HELD'), ['CONFIRMED', 'EXPIRED', 'CANCELLED']);
  assert.equal(service.canTransition('EXPIRED', 'CONFIRMED'), false);
  await assert.rejects(
    service.validateTransition({
      currentStatus: 'HELD',
      targetStatus: 'HELD',
      booking: {},
      actor: admin,
    }),
    BookingStatusError
  );
});

test('confirms paid unexpired holds, records actor/reason and confirms allocations', async () => {
  const data = fixture();
  await data.service.confirmBooking({
    bookingId: 'booking-1',
    actor: admin,
    reason: 'Payment completed',
  });
  assert.equal(data.booking.status, 'CONFIRMED');
  assert.equal(data.history[0].changedByUserId, 'admin-1');
  assert.equal(data.history[0].reason, 'Payment completed');
  assert.equal(data.effects.seatStatuses[0], 'CONFIRMED');
  assert.deepEqual(data.effects.allocationUpdates[0], {
    allocationType: 'CONFIRMED',
    expiresAt: null,
  });
});

test('rejects confirmation after expiry or without payment', async () => {
  const expired = fixture();
  expired.booking.holdExpiresAt = new Date('2026-07-31T23:59:00Z');
  await assert.rejects(
    () => expired.service.confirmBooking({ bookingId: 'booking-1', actor: admin }),
    BookingExpiredError
  );
  const unpaid = fixture('HELD', { paid: false });
  await assert.rejects(
    () => unpaid.service.confirmBooking({ bookingId: 'booking-1', actor: admin }),
    BookingStatusError
  );
});

test('cancellation and expiry release allocations; successful refund is required', async () => {
  const cancelled = fixture('CONFIRMED');
  await cancelled.service.cancelBooking({
    bookingId: 'booking-1',
    actor: admin,
    reason: 'Cancelled by admin',
  });
  assert.equal(cancelled.effects.allocationDeletes, 1);
  const expired = fixture();
  await expired.service.expireBooking({
    bookingId: 'booking-1',
    actor: system,
    reason: 'Hold expired',
  });
  assert.equal(expired.effects.allocationDeletes, 1);
  const missingRefund = fixture('CANCELLED', { refunded: false });
  await assert.rejects(
    () =>
      missingRefund.service.markRefunded({
        bookingId: 'booking-1',
        actor: system,
        reason: 'Refund complete',
      }),
    BookingStatusError
  );
});

test('completes confirmed bookings only after journey departure', async () => {
  const valid = fixture('CONFIRMED');
  await valid.service.completeBooking({
    bookingId: 'booking-1',
    actor: system,
    reason: 'Journey completed',
  });
  assert.equal(valid.booking.status, 'COMPLETED');
  const invalid = fixture('CONFIRMED', { journeyStatus: 'SCHEDULED' });
  await assert.rejects(
    () => invalid.service.completeBooking({ bookingId: 'booking-1', actor: system }),
    BookingStatusError
  );
});
