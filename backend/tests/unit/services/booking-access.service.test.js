'use strict';

const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const BookingAccessService = require('../../../src/modules/bookings/booking-access.service');

const hashIdentity = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('development OTP 123456 grants access after customer details match', async () => {
  const nic = '200012345678';
  const booking = {
    id: 'booking-1',
    contactEmail: 'customer@example.com',
    passengers: [{ passengerNumber: 1, identityNumberHash: hashIdentity(nic) }],
    update: async () => {},
  };
  const service = new BookingAccessService({
    bookingRepository: {
      findByReference: async () => booking,
      findById: async () => booking,
    },
    waitlistRepository: {},
    passengerIdentityService: {
      normalize: (_type, value) => String(value).trim(),
      prepare: ({ identityNumber }) => ({ identityNumberHash: hashIdentity(identityNumber) }),
    },
    guestBookingAccessService: {
      issue: () => ({ hash: 'access-hash', token: 'access-token', expiresAt: new Date('2026-08-04T01:00:00Z') }),
    },
    notificationService: null,
  });

  const { requestId } = await service.requestAccess({
    primaryNic: nic,
    bookingReference: 'REF-001',
    contact: { email: 'customer@example.com' },
  });
  const result = await service.verifyAccess({ requestId, otp: '123456' });

  assert.equal(result.bookingId, booking.id);
  assert.equal(result.guestAccessToken, 'access-token');
});

test('development OTP grants access to an existing booking when customer details do not match', async () => {
  const booking = {
    id: 'booking-2',
    contactEmail: 'another-customer@example.com',
    passengers: [{ passengerNumber: 1, identityNumberHash: hashIdentity('199912345678') }],
    update: async () => {},
  };
  const service = new BookingAccessService({
    bookingRepository: {
      findByReference: async () => booking,
      findById: async () => booking,
    },
    waitlistRepository: {},
    passengerIdentityService: {
      normalize: (_type, value) => String(value).trim(),
      prepare: ({ identityNumber }) => ({ identityNumberHash: hashIdentity(identityNumber) }),
    },
    guestBookingAccessService: {
      issue: () => ({ hash: 'access-hash', token: 'access-token', expiresAt: new Date('2026-08-04T01:00:00Z') }),
    },
    notificationService: null,
  });

  const { requestId } = await service.requestAccess({
    primaryNic: '200012345678',
    bookingReference: 'UNKNOWN',
    contact: { email: 'customer@example.com' },
  });

  const result = await service.verifyAccess({ requestId, otp: '123456' });

  assert.equal(result.bookingId, booking.id);
});

test('production mode requires matching customer details', async () => {
  const booking = {
    id: 'booking-3',
    contactEmail: 'another-customer@example.com',
    passengers: [{ passengerNumber: 1, identityNumberHash: hashIdentity('199912345678') }],
  };
  const service = new BookingAccessService({
    bookingRepository: { findByReference: async () => booking },
    waitlistRepository: {},
    passengerIdentityService: {
      normalize: (_type, value) => String(value).trim(),
      prepare: ({ identityNumber }) => ({ identityNumberHash: hashIdentity(identityNumber) }),
    },
    guestBookingAccessService: {},
    notificationService: null,
    developmentOtp: null,
  });

  const { requestId } = await service.requestAccess({
    primaryNic: '200012345678',
    bookingReference: 'REF-003',
    contact: { email: 'customer@example.com' },
  });

  await assert.rejects(service.verifyAccess({ requestId, otp: '123456' }), /Invalid or expired/);
});
