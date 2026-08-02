'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const WaitlistController = require('../../../src/modules/waitlist/waitlist.controller');
const { response, invoke, UUID } = require('./test-helpers');
test('waitlist controller joins as the authenticated passenger', async () => {
  let input;
  const controller = new WaitlistController({
    waitlistService: {
      joinWaitlist: async (value) => {
        input = value;
        return { waitlistEntryId: UUID };
      },
    },
  });
  const res = response();
  await invoke(
    controller.join,
    {
      user: { id: UUID },
      body: {
        journeyId: UUID,
        originJourneyStationId: '22222222-2222-4222-8222-222222222222',
        destinationJourneyStationId: '33333333-3333-4333-8333-333333333333',
        requestedCoachClass: 'SECOND_CLASS',
        passengerCount: 1,
        contact: { fullName: 'P', email: 'p@example.com' },
      },
    },
    res
  );
  assert.equal(input.userId, UUID);
  assert.equal(res.statusCode, 201);
});
