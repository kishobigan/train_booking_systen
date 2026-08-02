'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const services = require('../../src/container/services');
const { fetch, withServer } = require('./api-test-helpers');

test(
  'GET /api/v1/routes returns public route summaries',
  { skip: process.env.RUN_HTTP_TESTS !== 'true' },
  async () => {
    const original = services.routeService.getRoutes;
    services.routeService.getRoutes = async () => ({
      items: [{ id: 'r1', code: 'FOT-KDT', name: 'Fort to Kandy', isActive: true }],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/routes`);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.data[0].code, 'FOT-KDT');
      });
    } finally {
      services.routeService.getRoutes = original;
    }
  }
);
