'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const AvailabilityController = require('../../../src/modules/availability/availability.controller');
const { response, invoke, UUID } = require('./test-helpers');

test('availability controller delegates segment-safe seat lookup', async () => {
  let received;
  const controller = new AvailabilityController({
    getAvailableSeats: async (input) => {
      received = input;
      return { journeyId: input.journeyId, coaches: [] };
    },
  });
  const res = response();
  await invoke(
    controller.getSeatAvailability,
    {
      params: { journeyId: UUID },
      query: {
        originJourneyStationId: '22222222-2222-4222-8222-222222222222',
        destinationJourneyStationId: '33333333-3333-4333-8333-333333333333',
      },
    },
    res
  );
  assert.equal(received.journeyId, UUID);
  assert.deepEqual(res.body.data.coaches, []);
});
