'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const FareController = require('../../../src/modules/fares/fare.controller');
const { response, invoke, UUID } = require('./test-helpers');

test('fare controller accepts server-calculated coach-class quote input', async () => {
  let received;
  const controller = new FareController({
    quoteFare: async (input) => {
      received = input;
      return { totals: { finalTotal: '100.00' } };
    },
  });
  const res = response();
  await invoke(
    controller.quoteFare,
    {
      body: {
        journeyId: UUID,
        originJourneyStationId: '22222222-2222-4222-8222-222222222222',
        destinationJourneyStationId: '33333333-3333-4333-8333-333333333333',
        coachClass: 'SECOND_CLASS',
        passengers: [{ passengerType: 'ADULT' }],
      },
    },
    res
  );
  assert.equal(received.coachClass, 'SECOND_CLASS');
  assert.equal(res.body.data.totals.finalTotal, '100.00');
});
