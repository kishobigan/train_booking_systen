'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const SeatMapService = require('../../../src/modules/seatmap/seatmap.service');
const ids = {
  journey: '11111111-1111-4111-8111-111111111111',
  origin: '22222222-2222-4222-8222-222222222222',
  destination: '33333333-3333-4333-8333-333333333333',
};
function fixture(allocation = {}) {
  return new SeatMapService({
    journeyRepository: {
      findById: async () => ({ id: ids.journey, serviceNumber: '1005', status: 'SCHEDULED' }),
    },
    journeyStationRepository: {
      findOriginAndDestination: async () => [
        { id: ids.origin, sequenceNumber: 0, canBoard: true },
        { id: ids.destination, sequenceNumber: 3, canAlight: true },
      ],
    },
    seatMapRepository: {
      getJourneySeatMap: async () => [
        {
          journeySeatId: 'js1',
          seatId: 's1',
          seatNumber: '1A',
          journeySeatStatus: 'AVAILABLE',
          journeyCoachId: 'jc1',
          coachId: 'c1',
          coachNumber: 'R1',
          coachClass: 'SECOND_CLASS',
          reservationType: 'RESERVED',
          positionNumber: 1,
          coachAvailable: true,
          seatActive: true,
          rowNumber: 1,
          columnNumber: 1,
          ...allocation,
        },
      ],
    },
  });
}
test('seat map builds safe snapshot summaries and normalized allocation states', async () => {
  const available = await fixture().getSeatMapSnapshot({
    journeyId: ids.journey,
    originJourneyStationId: ids.origin,
    destinationJourneyStationId: ids.destination,
  });
  assert.equal(available.coaches[0].seats[0].status, 'AVAILABLE');
  assert.equal(available.summary.availableSeats, 1);
  const held = await fixture({
    allocationType: 'HELD',
    holdExpiresAt: new Date(),
  }).getSeatMapSnapshot({
    journeyId: ids.journey,
    originJourneyStationId: ids.origin,
    destinationJourneyStationId: ids.destination,
  });
  assert.equal(held.coaches[0].seats[0].status, 'HELD');
  assert.equal(held.coaches[0].seats[0].bookingId, undefined);
});
test('seat map rejects reversed snapshot segments', async () => {
  const service = fixture();
  service.journeyStationRepository.findOriginAndDestination = async () => [
    { id: ids.origin, sequenceNumber: 3 },
    { id: ids.destination, sequenceNumber: 0 },
  ];
  await assert.rejects(
    service.getSeatMapSnapshot({
      journeyId: ids.journey,
      originJourneyStationId: ids.origin,
      destinationJourneyStationId: ids.destination,
    })
  );
});
