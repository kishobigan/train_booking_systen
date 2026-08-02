'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const SeatAvailabilityService = require('../../../src/modules/availability/seat-availability.service');
const SeatUnavailableError = require('../../../src/common/errors/SeatUnavailableError');

function fixture() {
  const seats = new Map();
  const conflicts = new Map();
  const makeSeat = (id, overrides = {}) => ({
    id,
    journeyId: 'journey-1',
    seatId: `physical-${id}`,
    seatNumberSnapshot: id.toUpperCase(),
    status: 'AVAILABLE',
    seat: { isActive: true },
    journeyCoach: {
      coachNumberSnapshot: 'R1',
      coachClassSnapshot: 'SECOND_CLASS',
      reservationTypeSnapshot: 'RESERVED',
      isAvailable: true,
    },
    ...overrides,
  });
  seats.set('s1', makeSeat('s1'));
  seats.set('s2', makeSeat('s2'));
  seats.set('blocked', makeSeat('blocked', { status: 'BLOCKED' }));
  seats.set(
    'disabled-coach',
    makeSeat('disabled-coach', {
      journeyCoach: { ...makeSeat('x').journeyCoach, isAvailable: false },
    })
  );
  seats.set(
    'unreserved',
    makeSeat('unreserved', {
      journeyCoach: { ...makeSeat('x').journeyCoach, reservationTypeSnapshot: 'UNRESERVED' },
    })
  );
  const availabilityRepository = {
    async findSeatWithCoach(id) {
      return seats.get(id) || null;
    },
    async findSeatsWithCoach(ids) {
      return ids.map((id) => seats.get(id)).filter(Boolean);
    },
    async findOverlappingAllocation(journeyId, seatId) {
      return conflicts.get(seatId) || null;
    },
    async findAvailableSeats() {
      return [
        {
          journeySeatId: 's1',
          seatId: 'physical-s1',
          journeyCoachId: 'coach-1',
          seatNumber: '1A',
          coachNumber: 'R1',
          coachClass: 'SECOND_CLASS',
          available: true,
        },
        {
          journeySeatId: 's2',
          seatId: 'physical-s2',
          journeyCoachId: 'coach-1',
          seatNumber: '1B',
          coachNumber: 'R1',
          coachClass: 'SECOND_CLASS',
          available: true,
        },
      ];
    },
    async countAvailableSeats() {
      return 2;
    },
    async countUnavailableSeats() {
      return 1;
    },
    async getJourneySeatTotals() {
      return { totalReservedSeats: 3, availableSeats: 2, unavailableSeats: 1 };
    },
    async findCoachSeatCounts() {
      return [
        {
          journeyCoachId: 'coach-1',
          coachNumber: 'R1',
          coachClass: 'SECOND_CLASS',
          totalSeats: 3,
          availableSeats: 2,
          unavailableSeats: 1,
          isAvailable: true,
        },
      ];
    },
    async findSeatAllocations() {
      return [];
    },
  };
  const service = new SeatAvailabilityService({
    journeyRepository: {
      async findById() {
        return { id: 'journey-1', status: 'SCHEDULED' };
      },
    },
    journeyStationRepository: {
      async findOriginAndDestination() {
        return [
          {
            id: 'origin',
            stationId: 'a',
            sequenceNumber: 0,
            distanceFromStartKm: '0',
            canBoard: true,
          },
          {
            id: 'destination',
            stationId: 'b',
            sequenceNumber: 3,
            distanceFromStartKm: '120',
            canAlight: true,
          },
        ];
      },
    },
    journeyCoachRepository: {},
    journeySeatRepository: {},
    availabilityRepository,
    activeSeatAllocationRepository: {
      async deleteExpiredHoldsForSeats() {},
    },
  });
  return { service, conflicts };
}

test('returns available seats and rejects intrinsic seat or coach restrictions', async () => {
  const data = fixture();
  assert.equal(
    (
      await data.service.checkSeatAvailability({
        journeyId: 'journey-1',
        journeySeatId: 's1',
        originSequence: 0,
        destinationSequence: 3,
      })
    ).available,
    true
  );
  for (const journeySeatId of ['blocked', 'disabled-coach', 'unreserved']) {
    assert.equal(
      (
        await data.service.checkSeatAvailability({
          journeyId: 'journey-1',
          journeySeatId,
          originSequence: 0,
          destinationSequence: 3,
        })
      ).available,
      false
    );
  }
});

test('rejects active overlapping allocations while repository expiry filtering allows adjacent or expired holds', async () => {
  const data = fixture();
  data.conflicts.set('physical-s1', {
    id: 'allocation-1',
    occupiedSegment: [{ value: 2 }, { value: 5 }],
    allocationType: 'CONFIRMED',
  });
  const result = await data.service.checkSeatAvailability({
    journeyId: 'journey-1',
    journeySeatId: 's1',
    originSequence: 0,
    destinationSequence: 3,
  });
  assert.equal(result.available, false);
  assert.equal(result.conflict.allocationId, 'allocation-1');
  data.conflicts.delete('physical-s1');
  assert.equal(
    (
      await data.service.checkSeatAvailability({
        journeyId: 'journey-1',
        journeySeatId: 's1',
        originSequence: 3,
        destinationSequence: 6,
      })
    ).available,
    true
  );
});

test('returns all multi-seat conflicts and throws during booking revalidation', async () => {
  const data = fixture();
  data.conflicts.set('physical-s2', { id: 'allocation-2', allocationType: 'HELD' });
  const preview = await data.service.checkMultipleSeatsAvailability({
    journeyId: 'journey-1',
    journeySeatIds: ['s1', 's2'],
    originSequence: 0,
    destinationSequence: 3,
  });
  assert.deepEqual(
    {
      allAvailable: preview.allAvailable,
      available: preview.availableCount,
      unavailable: preview.unavailableCount,
    },
    { allAvailable: false, available: 1, unavailable: 1 }
  );
  await assert.rejects(
    () =>
      data.service.revalidateSeatsForBooking({
        journeyId: 'journey-1',
        journeySeatIds: ['s1', 's2'],
        originSequence: 0,
        destinationSequence: 3,
        transaction: { id: 'tx' },
      }),
    SeatUnavailableError
  );
});

test('calculates available counts and coach occupancy', async () => {
  const data = fixture();
  const input = { journeyId: 'journey-1', originSequence: 0, destinationSequence: 3 };
  assert.equal(await data.service.getAvailableSeatCount(input), 2);
  assert.equal(await data.service.getUnavailableSeatCount(input), 1);
  assert.equal((await data.service.getCoachAvailability(input))[0].occupancyPercentage, '33.33');
  assert.equal(
    (await data.service.getJourneyAvailabilitySummary(input)).occupancyPercentage,
    '33.33'
  );
});
