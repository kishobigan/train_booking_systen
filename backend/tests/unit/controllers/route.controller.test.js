'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const RouteController = require('../../../src/modules/routes/route.controller');
const { response, invoke, UUID } = require('./test-helpers');

test('route controller delegates protected creation with the authenticated actor', async () => {
  const actor = { id: UUID, role: 'SUPER_ADMIN' };
  let received;
  const controller = new RouteController({
    createRouteWithStations: async (input) => {
      received = input;
      return { id: UUID, code: 'A-B', name: 'A to B', routeStations: [] };
    },
  });
  const res = response();
  await invoke(
    controller.create,
    {
      user: actor,
      body: {
        code: 'A-B',
        name: 'A to B',
        startStationId: UUID,
        endStationId: '22222222-2222-4222-8222-222222222222',
        stations: [
          { stationId: UUID, sequenceNumber: 0, distanceFromStartKm: 0 },
          {
            stationId: '22222222-2222-4222-8222-222222222222',
            sequenceNumber: 1,
            distanceFromStartKm: 1,
          },
        ],
      },
    },
    res
  );
  assert.equal(received.actor, actor);
  assert.equal(res.statusCode, 201);
});
