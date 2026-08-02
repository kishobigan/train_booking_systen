'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const BookingService = require('../../../src/modules/bookings/booking.service');
const BookingConflictError = require('../../../src/common/errors/BookingConflictError');
const ValidationError = require('../../../src/common/errors/ValidationError');

function fixture({ journeyStatus = 'SCHEDULED', available = true } = {}) {
  const stored = {
    bookings: [],
    passengers: [],
    bookingSeats: [],
    allocations: [],
    history: [],
    locks: [],
  };
  let passengerId = 0;
  let bookingSeatId = 0;
  const seatResults = [
    {
      available,
      journeySeatId: 'js-1',
      seatId: 'seat-1',
      seatNumber: '1A',
      coachNumber: 'R1',
      coachClass: 'SECOND_CLASS',
    },
    {
      available,
      journeySeatId: 'js-2',
      seatId: 'seat-2',
      seatNumber: '1B',
      coachNumber: 'R1',
      coachClass: 'SECOND_CLASS',
    },
  ];
  const fare = {
    passengers: [
      { fareBeforeDiscount: '760.00', discountAmount: '0.00', fareAfterDiscount: '760.00' },
      { fareBeforeDiscount: '760.00', discountAmount: '380.00', fareAfterDiscount: '380.00' },
    ],
    totals: {
      passengerSubtotal: '1140.00',
      discountTotal: '380.00',
      serviceFee: '28.50',
      taxAmount: '58.43',
      finalTotal: '1226.93',
      currency: 'LKR',
    },
  };
  const bookingPassengerService = {
    validatePassengerList(passengers) {
      const ids = passengers.map((item) => item.journeySeatId);
      if (new Set(ids).size !== ids.length)
        throw new ValidationError('Duplicate journey seats are not allowed');
    },
    async bulkCreatePassengers({ bookingId, passengers }) {
      const rows = passengers.map((passenger, index) => ({
        id: `p-${++passengerId}`,
        bookingId,
        ...passenger,
        assignedSeatId: `seat-${index + 1}`,
        finalFare: fare.passengers[index].fareAfterDiscount,
      }));
      stored.passengers.push(...rows);
      return rows;
    },
  };
  const service = new BookingService({
    bookingRepository: {
      async create(values) {
        const row = { id: 'booking-1', ...values };
        stored.bookings.push(row);
        return row;
      },
    },
    bookingPassengerService,
    bookingSeatService: {
      async bulkCreateBookingSeats({ seats }) {
        const rows = seats.map((seat) => ({ id: `bs-${++bookingSeatId}`, ...seat }));
        stored.bookingSeats.push(...rows);
        return rows;
      },
    },
    allocationService: {
      repository: {
        async acquireSeatLocks({ seatIds }) {
          stored.locks.push(...seatIds);
        },
      },
      async createAllocations({ allocations }) {
        stored.allocations.push(...allocations);
        return allocations;
      },
    },
    bookingStatusService: {},
    journeyService: {
      async getJourney() {
        return { id: 'journey-1', status: journeyStatus };
      },
    },
    seatAvailabilityService: {
      async resolveSegmentSequences() {
        return { segment: { originSequence: 0, destinationSequence: 3 } };
      },
      async checkMultipleSeatsAvailability() {
        return { allAvailable: available, seats: seatResults };
      },
      async revalidateSeatsForBooking() {
        return { allAvailable: available, seats: seatResults };
      },
    },
    fareCalculationService: {
      async calculateBookingFare() {
        return fare;
      },
    },
    transactionManager: {
      async executeSerializable(callback) {
        return callback({ LOCK: { UPDATE: 'UPDATE' }, afterCommit() {} });
      },
    },
    bookingStatusRepository: {
      async createStatusHistory(values) {
        stored.history.push(values);
      },
    },
    holdMinutes: 10,
    maximumPassengers: 6,
    clock: () => new Date('2026-08-01T00:00:00Z'),
  });
  return { service, stored };
}

function request(overrides = {}) {
  return {
    userId: 'user-1',
    journeyId: 'journey-1',
    originJourneyStationId: 'origin-1',
    destinationJourneyStationId: 'destination-1',
    passengers: [
      { fullName: 'Adult Passenger', passengerType: 'ADULT', journeySeatId: 'js-1' },
      { fullName: 'Child Passenger', passengerType: 'CHILD', journeySeatId: 'js-2' },
    ],
    contact: { fullName: 'Contact', email: 'contact@example.com' },
    subtotal: '0.01',
    totalAmount: '0.01',
    ...overrides,
  };
}

test('creates an atomic multi-passenger hold using server fare totals', async () => {
  const data = fixture();
  const result = await data.service.createBookingHold(request());
  assert.equal(result.status, 'HELD');
  assert.equal(result.totals.totalAmount, '1226.93');
  assert.equal(data.stored.bookings[0].totalAmount, '1226.93');
  assert.equal(data.stored.passengers.length, 2);
  assert.equal(data.stored.bookingSeats.length, 2);
  assert.equal(data.stored.allocations.length, 2);
  assert.deepEqual(data.stored.locks.sort(), ['seat-1', 'seat-2']);
  assert.equal(data.stored.history[0].newStatus, 'HELD');
});

test('rejects cancelled journeys, unavailable seats and duplicate selections', async () => {
  await assert.rejects(
    () => fixture({ journeyStatus: 'CANCELLED' }).service.createBookingHold(request()),
    BookingConflictError
  );
  await assert.rejects(
    () => fixture({ available: false }).service.createBookingHold(request()),
    BookingConflictError
  );
  const duplicate = request({
    passengers: [
      { fullName: 'One', passengerType: 'ADULT', journeySeatId: 'js-1' },
      { fullName: 'Two', passengerType: 'ADULT', journeySeatId: 'js-1' },
    ],
  });
  await assert.rejects(() => fixture().service.createBookingHold(duplicate), ValidationError);
});

test('rejects unsupported idempotency until durable database storage exists', async () => {
  await assert.rejects(
    () => fixture().service.createBookingHold(request({ idempotencyKey: 'client-key' })),
    ValidationError
  );
});
