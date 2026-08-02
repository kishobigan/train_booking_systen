'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const BookingJob = require('../../../src/jobs/expire-booking-holds.job');
const WaitlistJob = require('../../../src/jobs/expire-waitlist-offers.job');
const config = { batchSize: 2, maxPerRun: 2, maxRecordFailures: 5 };
test('booking job processes candidates through booking service', async () => {
  const called = [];
  const job = new BookingJob({
    bookingRepository: { findExpiredHeldBookingIds: async () => ['a', 'b'] },
    bookingService: {
      expireBooking: async (input) => {
        called.push(input);
        return { status: 'EXPIRED' };
      },
    },
    config,
    logger: { error() {} },
  });
  const result = await job.execute();
  assert.equal(result.succeeded, 2);
  assert.deepEqual(
    called.map((x) => x.bookingId),
    ['a', 'b']
  );
});
test('booking job continues after isolated failure', async () => {
  const job = new BookingJob({
    bookingRepository: { findExpiredHeldBookingIds: async () => ['a', 'b'] },
    bookingService: {
      expireBooking: async ({ bookingId }) => {
        if (bookingId === 'a') throw new Error('bad');
        return { status: 'EXPIRED' };
      },
    },
    config,
    logger: { error() {} },
  });
  const result = await job.execute();
  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 1);
});
test('waitlist job delegates offer expiry', async () => {
  const called = [];
  const job = new WaitlistJob({
    waitlistRepository: { findExpiredOfferIds: async () => ['w'] },
    waitlistService: {
      expireOffer: async (input) => {
        called.push(input);
        return { status: 'EXPIRED' };
      },
    },
    config: { ...config, maxPerRun: 1 },
    logger: { error() {} },
  });
  assert.equal((await job.execute()).succeeded, 1);
  assert.equal(called[0].waitlistEntryId, 'w');
});
