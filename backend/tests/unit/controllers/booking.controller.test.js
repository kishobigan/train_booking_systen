'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const BookingController = require('../../../src/modules/bookings/booking.controller');
const { response, invoke, UUID } = require('./test-helpers');
test('booking controller creates a hold with authenticated ownership and idempotency', async () => {
  let input;
  const controller = new BookingController({
    bookingStatusService: {},
    bookingService: {
      createBookingHold: async (value) => {
        input = value;
        return { bookingId: UUID, status: 'HELD' };
      },
    },
  });
  const res = response();
  await invoke(
    controller.createHold,
    {
      user: { id: UUID },
      get: () => 'key-1',
      body: {
        journeyId: UUID,
        originJourneyStationId: '22222222-2222-4222-8222-222222222222',
        destinationJourneyStationId: '33333333-3333-4333-8333-333333333333',
        passengers: [
          {
            fullName: 'Passenger',
            passengerType: 'ADULT',
            journeySeatId: '44444444-4444-4444-8444-444444444444',
          },
        ],
        contact: { fullName: 'Passenger', email: 'p@example.com' },
      },
    },
    res
  );
  assert.equal(input.userId, UUID);
  assert.equal(input.idempotencyKey, 'key-1');
  assert.equal(res.statusCode, 201);
});
