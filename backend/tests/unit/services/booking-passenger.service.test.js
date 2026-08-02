'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const BookingPassengerService = require('../../../src/modules/bookings/booking-passenger.service');
const ValidationError = require('../../../src/common/errors/ValidationError');

function fixture() {
  const rows = [];
  const repository = {
    async create(values) {
      const row = record({ id: `p-${rows.length + 1}`, ...values });
      rows.push(row);
      return row;
    },
    async bulkCreate(values) {
      return Promise.all(values.map((value) => this.create(value)));
    },
    async findById(id) {
      return rows.find((row) => row.id === id) || null;
    },
    async findByBookingAndId(bookingId, id) {
      return rows.find((row) => row.bookingId === bookingId && row.id === id) || null;
    },
    async findByAssignedSeat(bookingId, seatId) {
      return (
        rows.find((row) => row.bookingId === bookingId && row.assignedSeatId === seatId) || null
      );
    },
  };
  function record(values) {
    return {
      ...values,
      async update(changes) {
        Object.assign(this, changes);
        return this;
      },
      async destroy() {
        rows.splice(rows.indexOf(this), 1);
      },
    };
  }
  const booking = {
    id: 'b-1',
    journeyId: 'j-1',
    status: 'HELD',
    originSequence: 0,
    destinationSequence: 3,
    holdExpiresAt: new Date(Date.now() + 60_000),
  };
  const service = new BookingPassengerService({
    bookingPassengerRepository: repository,
    journeySeatRepository: {
      async findByIdWithCoach(id) {
        return {
          id,
          journeyId: 'j-1',
          seatId: `physical-${id}`,
          seatNumberSnapshot: '1A',
          journeyCoach: { coachNumberSnapshot: 'R1', coachClassSnapshot: 'SECOND_CLASS' },
        };
      },
    },
    bookingRepository: {
      async findByIdForUpdate() {
        return booking;
      },
    },
    bookingSeatRepository: {
      async findByPassenger() {
        return null;
      },
      async create(values) {
        return { id: 'bs-new', ...values, async destroy() {} };
      },
    },
    allocationService: {
      repository: { async acquireSeatLocks() {} },
      async createAllocation() {},
      async releaseAllocation() {},
    },
    seatAvailabilityService: {
      async assertSeatAvailable() {
        return true;
      },
    },
    transactionManager: {
      async executeSerializable(callback) {
        return callback({ LOCK: { UPDATE: 'UPDATE' } });
      },
    },
    maximumPassengers: 6,
  });
  return { service, rows };
}
const fare = {
  passengers: [
    { fareBeforeDiscount: '100.00', discountAmount: '20.00', fareAfterDiscount: '80.00' },
  ],
};

test('bulk creates passengers using calculated fares and assigns/removes seats', async () => {
  const data = fixture();
  const passengers = await data.service.bulkCreatePassengers({
    bookingId: 'b-1',
    passengers: [{ fullName: 'Passenger', passengerType: 'ADULT', journeySeatId: 'js-1' }],
    fareBreakdown: fare,
    assignedSeatIds: ['seat-1'],
    transaction: {},
  });
  assert.equal(passengers[0].finalFare, '80.00');
  await data.service.assignSeat({
    bookingId: 'b-1',
    bookingPassengerId: passengers[0].id,
    journeySeatId: 'js-2',
    transaction: {},
  });
  assert.equal(passengers[0].assignedSeatId, 'physical-js-2');
  await data.service.removeSeat({
    bookingId: 'b-1',
    bookingPassengerId: passengers[0].id,
    transaction: {},
  });
  assert.equal(passengers[0].assignedSeatId, null);
});
test('rejects invalid types, duplicate seats, and fare-count mismatch', async () => {
  const data = fixture();
  assert.throws(
    () => data.service.validatePassenger({ fullName: 'X', passengerType: 'UNKNOWN' }),
    ValidationError
  );
  assert.throws(
    () =>
      data.service.validatePassengerList([
        { fullName: 'A', passengerType: 'ADULT', journeySeatId: 'same' },
        { fullName: 'B', passengerType: 'ADULT', journeySeatId: 'same' },
      ]),
    ValidationError
  );
  assert.throws(
    () =>
      data.service.bulkCreatePassengers({
        bookingId: 'b',
        passengers: [
          { fullName: 'A', passengerType: 'ADULT' },
          { fullName: 'B', passengerType: 'ADULT' },
        ],
        fareBreakdown: fare,
        assignedSeatIds: [],
      }),
    ValidationError
  );
});
