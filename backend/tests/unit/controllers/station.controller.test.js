'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const StationController = require('../../../src/modules/stations/station.controller');
const { response, invoke } = require('./test-helpers');

test('station controller returns a paginated safe station list', async () => {
  const controller = new StationController({
    getStations: async () => ({
      items: [{ id: 's1', code: 'FOT', name: 'Fort', passwordHash: 'hidden' }],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    }),
  });
  const res = response();
  await invoke(controller.list, { query: {} }, res);
  assert.equal(res.body.data[0].code, 'FOT');
  assert.equal(res.body.data[0].passwordHash, undefined);
  assert.equal(res.body.pagination.totalItems, 1);
});
