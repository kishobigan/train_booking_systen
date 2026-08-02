'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WaitlistService = require('../../../src/modules/waitlist/waitlist.service');

function transactionManager() {
  return {
    executeSerializable: (callback) =>
      callback({ LOCK: { UPDATE: 'UPDATE' }, afterCommit: (work) => work() }),
  };
}

function service(overrides = {}) {
  return new WaitlistService({
    config: { enabled: true, maxPassengersPerEntry: 6, requeueExpiredOffers: false },
    transactionManager: transactionManager(),
    waitlistRepository: {
      findDuplicateActiveEntry: async () => null,
      create: async (values) => ({ id: 'entry-1', priorityNumber: 1, ...values }),
    },
    seatAvailabilityService: {
      resolveSegmentSequences: async () => ({
        journey: { status: 'SCHEDULED' },
        segment: { originSequence: 0, destinationSequence: 3 },
      }),
      getAvailableSeatCount: async () => 0,
    },
    journeyCoachRepository: {
      findAvailableByJourney: async () => [{ coachClassSnapshot: 'SECOND_CLASS' }],
    },
    bookingService: {
      validateJourneyForBooking: () => true,
      validateBookingWindow: () => true,
    },
    auditService: { record: async () => undefined },
    notificationService: { waitlistStatusChanged: async () => undefined },
    ...overrides,
  });
}

const joinInput = {
  userId: 'user-1',
  journeyId: 'journey-1',
  originJourneyStationId: 'origin-1',
  destinationJourneyStationId: 'destination-1',
  requestedCoachClass: 'SECOND_CLASS',
  passengerCount: 1,
  contact: { fullName: 'Passenger', email: 'passenger@example.com' },
};

test('joins an unavailable journey segment with server-owned status and sequence values', async () => {
  const result = await service().joinWaitlist(joinInput);
  assert.equal(result.status, 'WAITING');
  assert.deepEqual(result.segment, { originSequence: 0, destinationSequence: 3 });
});

test('rejects joining when enough seats are already available', async () => {
  const instance = service({
    seatAvailabilityService: {
      resolveSegmentSequences: async () => ({
        journey: { status: 'SCHEDULED' },
        segment: { originSequence: 0, destinationSequence: 3 },
      }),
      getAvailableSeatCount: async () => 1,
    },
  });
  await assert.rejects(() => instance.joinWaitlist(joinInput), /normal booking/);
});

test('rejects passenger-count mismatch before converting an offer', async () => {
  const entry = {
    id: 'entry-1',
    userId: 'user-1',
    status: 'OFFERED',
    passengerCount: 2,
    offerExpiresAt: new Date(Date.now() + 60_000),
  };
  const instance = service({
    waitlistRepository: { findByIdForUpdate: async () => entry },
  });
  await assert.rejects(
    () =>
      instance.acceptOffer({
        waitlistEntryId: entry.id,
        userId: entry.userId,
        passengers: [{}],
        contact: {},
      }),
    /Passenger count must match/
  );
});
