'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const BookingService = require('../../../src/modules/bookings/booking.service');
const BookingConflictError = require('../../../src/common/errors/BookingConflictError');

function fixture(conflicts = []) {
  const stored = { bookings: [], passengers: [], seats: [], allocations: [] };
  const fare = {
    origin: { sequenceNumber: 0 },
    destination: { sequenceNumber: 3 },
    coach: {
      journeySeatId: 'journey-seat-1',
      seatId: 'seat-1',
      seatNumber: '1A',
      coachNumber: 'R1',
      coachClass: 'FIRST_CLASS',
    },
    passengers: [
      {
        passengerType: 'ADULT',
        fareBeforeDiscount: '1140.00',
        discountAmount: '0.00',
        fareAfterDiscount: '1140.00',
      },
    ],
    totals: {
      passengerSubtotal: '1140.00',
      discountTotal: '0.00',
      serviceFee: '28.50',
      taxAmount: '58.43',
      finalTotal: '1226.93',
      currency: 'LKR',
    },
  };
  const service = new BookingService({
    bookingRepository: {
      async create(values) {
        const item = { id: 'booking-1', ...values };
        stored.bookings.push(item);
        return item;
      },
    },
    bookingPassengerRepository: {
      async bulkCreate(values) {
        const items = values.map((value, index) => ({ id: `passenger-${index + 1}`, ...value }));
        stored.passengers.push(...items);
        return items;
      },
    },
    bookingSeatRepository: {
      async create(values) {
        const item = { id: 'booking-seat-1', ...values };
        stored.seats.push(item);
        return item;
      },
    },
    activeSeatAllocationRepository: {
      async lockConflicts() {
        return conflicts;
      },
      async create(values) {
        stored.allocations.push(values);
        return values;
      },
    },
    fareCalculationService: {
      async calculateBookingFare() {
        return fare;
      },
    },
    seatAvailabilityService: {
      async revalidateSeatsForBooking() {
        return { allAvailable: true };
      },
    },
    bookingStatusRepository: {
      async createStatusHistory() {},
    },
    transactionProvider: {
      async transaction(callback) {
        return callback({ id: 'tx', LOCK: { UPDATE: 'UPDATE' } });
      },
    },
    holdMinutes: 15,
    clock: () => new Date('2026-08-01T00:00:00.000Z'),
  });
  return { service, stored };
}

function request() {
  return {
    journeyId: 'journey-1',
    originJourneyStationId: 'origin-1',
    destinationJourneyStationId: 'destination-1',
    journeySeatId: 'journey-seat-1',
    contactName: 'Test User',
    contactEmail: 'test@example.com',
    passengers: [{ fullName: 'Passenger One', passengerType: 'ADULT' }],
    subtotal: '0.01',
    totalAmount: '0.01',
  };
}

test('recalculates and stores authoritative fare snapshots inside the hold transaction', async () => {
  const data = fixture();
  const result = await data.service.createBookingHold(request());
  assert.equal(result.booking.subtotal, '1140.00');
  assert.equal(result.booking.totalAmount, '1226.93');
  assert.equal(result.booking.totalAmount === request().totalAmount, false);
  assert.equal(data.stored.passengers[0].finalFare, '1140.00');
  assert.equal(data.stored.seats[0].fareAmount, '1140.00');
  assert.equal(data.stored.allocations[0].allocationType, 'HELD');
  assert.equal(result.booking.holdExpiresAt.toISOString(), '2026-08-01T00:15:00.000Z');
});

test('rejects a conflicting segment before persisting the booking', async () => {
  const data = fixture([{ id: 'existing-allocation' }]);
  await assert.rejects(() => data.service.createBookingHold(request()), BookingConflictError);
  assert.equal(data.stored.bookings.length, 0);
});
