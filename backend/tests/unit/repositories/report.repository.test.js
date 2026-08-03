'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
const ReportRepository = require('../../../src/modules/reports/report.repository');

test('serializes empty global journey scope as a valid PostgreSQL UUID array', async () => {
  let queryOptions;
  const repository = new ReportRepository({
    query: async (_sql, options) => {
      queryOptions = options;
      return [];
    },
  });
  await repository.getBookingStatusCounts({
    allJourneys: true,
    journeyIds: [],
    dateFrom: new Date('2026-08-01'),
    dateToExclusive: new Date('2026-09-01'),
  });
  assert.equal(queryOptions.replacements.journeyIds, '{}');
});

test('serializes assigned journey IDs without Sequelize list expansion', async () => {
  let queryOptions;
  const repository = new ReportRepository({
    query: async (_sql, options) => {
      queryOptions = options;
      return [];
    },
  });
  const id = '11111111-1111-4111-8111-111111111111';
  await repository.getSegmentOccupancy({ allJourneys: false, journeyIds: [id] });
  assert.equal(queryOptions.replacements.journeyIds, `{${id}}`);
});
