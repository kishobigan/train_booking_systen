'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const GuestBookingAccessService = require('../../../src/modules/bookings/guest-booking-access.service');

test('guest token authorizes only its booking and expires', async () => {
  const records = new Map();
  const clock = () => new Date('2026-08-03T00:00:00Z');
  const service = new GuestBookingAccessService({
    bookingRepository: { findDetails: (id) => records.get(id) },
    config: { secret: 'guest-test-secret', ttlSeconds: 60 },
    clock,
  });
  const issued = service.issue();
  records.set('one', {
    id: 'one',
    guestAccessTokenHash: issued.hash,
    guestAccessTokenExpiresAt: issued.expiresAt,
  });
  records.set('two', {
    id: 'two',
    guestAccessTokenHash: '0'.repeat(64),
    guestAccessTokenExpiresAt: issued.expiresAt,
  });
  assert.equal((await service.authorize('one', issued.token)).id, 'one');
  await assert.rejects(
    service.authorize('two', issued.token),
    /Invalid guest booking access token/
  );
  records.get('one').guestAccessTokenExpiresAt = new Date('2026-08-02T00:00:00Z');
  await assert.rejects(service.authorize('one', issued.token), /expired/);
});
