'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const services = require('../../src/container/services');
const { fetch, withServer } = require('./api-test-helpers');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const J = '33333333-3333-4333-8333-333333333333';

test(
  'POST /api/v1/fares/quote returns backend-owned totals',
  { skip: process.env.RUN_HTTP_TESTS !== 'true' },
  async () => {
    const original = services.fareCalculationService.quoteFare;
    services.fareCalculationService.quoteFare = async () => ({
      journeyId: J,
      totals: { finalTotal: '760.00', currency: 'LKR' },
    });
    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/fares/quote`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            journeyId: J,
            originJourneyStationId: A,
            destinationJourneyStationId: B,
            coachClass: 'SECOND_CLASS',
            passengers: [{ passengerType: 'ADULT' }],
          }),
        });
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.data.totals.finalTotal, '760.00');
      });
    } finally {
      services.fareCalculationService.quoteFare = original;
    }
  }
);
