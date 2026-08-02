'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const JourneyController = require('../../../src/modules/journeys/journey.controller');
const { response, invoke, UUID } = require('./test-helpers');

test('journey controller returns search metadata and pagination', async () => {
  const controller = new JourneyController({
    searchPublicJourneys: async (input) => ({
      search: input,
      items: [{ journeyId: UUID }],
      pagination: { page: 1, totalItems: 1 },
    }),
  });
  const res = response();
  await invoke(
    controller.search,
    {
      query: {
        originStationId: UUID,
        destinationStationId: '22222222-2222-4222-8222-222222222222',
        date: '2026-08-15',
      },
    },
    res
  );
  assert.equal(res.body.data.items[0].journeyId, UUID);
  assert.equal(res.body.pagination.totalItems, 1);
});
