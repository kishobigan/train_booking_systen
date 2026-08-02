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
const J = '33333333-3333-4333-8333-333333333333';

test(
  'GET journey seat availability returns a segment response',
  { skip: process.env.RUN_HTTP_TESTS !== 'true' },
  async () => {
    const original = services.seatAvailabilityService.getAvailableSeats;
    services.seatAvailabilityService.getAvailableSeats = async (input) => ({
      journeyId: input.journeyId,
      totalAvailableSeats: 2,
      coaches: [],
    });
    try {
      await withServer(async (baseUrl) => {
        const query = new URLSearchParams({
          originJourneyStationId: A,
          destinationJourneyStationId: B,
        });
        const response = await fetch(`${baseUrl}/api/v1/journeys/${J}/availability/seats?${query}`);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.data.totalAvailableSeats, 2);
      });
    } finally {
      services.seatAvailabilityService.getAvailableSeats = original;
    }
  }
);
