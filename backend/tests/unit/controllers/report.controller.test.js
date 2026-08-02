'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const ReportController = require('../../../src/modules/reports/report.controller');
const { response, invoke, UUID } = require('./test-helpers');
test('report controller delegates dashboard with authenticated actor', async () => {
  let input;
  const actor = { id: UUID, role: 'ADMIN' };
  const controller = new ReportController({
    reportService: {
      getDashboardSummary: async (value) => {
        input = value;
        return { scope: { type: 'ASSIGNED_JOURNEYS' } };
      },
    },
  });
  const res = response();
  await invoke(controller.getDashboard, { user: actor, query: {}, params: {} }, res);
  assert.equal(input.actor, actor);
  assert.equal(res.body.data.scope.type, 'ASSIGNED_JOURNEYS');
});
