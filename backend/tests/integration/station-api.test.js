'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const services = require('../../src/container/services');
const { fetch, withServer } = require('./api-test-helpers');

test(
  'GET /api/v1/stations returns paginated stations',
  { skip: process.env.RUN_HTTP_TESTS !== 'true' },
  async () => {
    const original = services.stationService.getStations;
    services.stationService.getStations = async () => ({
      items: [{ id: 's1', code: 'FOT', name: 'Fort', isActive: true }],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/stations`);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.data[0].code, 'FOT');
        assert.equal(body.pagination.totalItems, 1);
      });
    } finally {
      services.stationService.getStations = original;
    }
  }
);
