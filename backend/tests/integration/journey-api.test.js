'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const { URLSearchParams } = require('node:url');
const services = require('../../src/container/services');
const { fetch, withServer } = require('./api-test-helpers');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test(
  'GET /api/v1/journeys/search returns snapshot-based results',
  { skip: process.env.RUN_HTTP_TESTS !== 'true' },
  async () => {
    const original = services.journeyService.searchPublicJourneys;
    services.journeyService.searchPublicJourneys = async (input) => ({
      search: input,
      items: [{ journeyId: 'j1', availableSeatCount: 3 }],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    try {
      await withServer(async (baseUrl) => {
        const query = new URLSearchParams({
          originStationId: A,
          destinationStationId: B,
          date: '2026-08-15',
        });
        const response = await fetch(`${baseUrl}/api/v1/journeys/search?${query}`);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.data.items[0].availableSeatCount, 3);
      });
    } finally {
      services.journeyService.searchPublicJourneys = original;
    }
  }
);
