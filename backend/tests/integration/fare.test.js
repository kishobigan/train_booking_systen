'use strict';
/* global fetch */

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const createApp = require('../../src/app');
const services = require('../../src/container/services');

test(
  'POST /api/v1/fares/quote returns the service fare breakdown',
  { skip: process.env.RUN_HTTP_TESTS !== 'true' },
  async (t) => {
    const original = services.fareCalculationService.quoteFare;
    services.fareCalculationService.quoteFare = async (input) => ({
      journeyId: input.journeyId,
      distanceKm: '120.00',
      passengers: [],
      totals: {
        passengerSubtotal: '1140.00',
        serviceFee: '28.50',
        taxAmount: '58.43',
        finalTotal: '1226.93',
        currency: 'LKR',
      },
    });
    const server = createApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => {
      services.fareCalculationService.quoteFare = original;
      server.close();
    });
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/fares/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ journeyId: 'journey-id' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: {
        journeyId: 'journey-id',
        distanceKm: '120.00',
        passengers: [],
        totals: {
          passengerSubtotal: '1140.00',
          serviceFee: '28.50',
          taxAmount: '58.43',
          finalTotal: '1226.93',
          currency: 'LKR',
        },
      },
    });
  }
);
