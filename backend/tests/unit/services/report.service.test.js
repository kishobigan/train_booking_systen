'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const ReportService = require('../../../src/modules/reports/report.service');
const AuthorizationError = require('../../../src/common/errors/AuthorizationError');
const period = { dateFrom: new Date('2026-08-01'), dateTo: new Date('2026-08-31') };
function service() {
  return new ReportService({
    accessControlService: {
      getAdminJourneys: async () => [{ journeyId: 'j1' }],
      assertAdminJourneyAccess: async ({ journeyId }) => {
        if (journeyId !== 'j1') throw new AuthorizationError();
      },
    },
    reportRepository: {
      getBookingStatusCounts: async () => [{ status: 'CONFIRMED', count: 2 }],
      getPaymentStatusCounts: async () => [{ status: 'PAID', count: 2 }],
      getWaitlistStatusCounts: async () => [{ status: 'WAITING', count: 1 }],
      getRevenueSummary: async () => ({ grossRevenue: '100.00', refundAmount: '10.00' }),
      getSegmentOccupancy: async () => [
        {
          journeyId: 'j1',
          sequenceNumber: 0,
          fromStationId: 'a',
          fromCode: 'A',
          fromName: 'A',
          toStationId: 'b',
          toCode: 'B',
          toName: 'B',
          totalSeats: 10,
          occupiedSeats: 4,
        },
      ],
      getRevenueByPaymentMethod: async () => [],
      getJourneyRevenue: async () => [],
      getRevenueTrend: async () => [],
    },
  });
}
test('admin dashboard is assigned, revenue is net, and occupancy is segment-aware', async () => {
  const result = await service().getDashboardSummary({
    actor: { id: 'a', role: 'ADMIN' },
    ...period,
  });
  assert.equal(result.scope.journeyCount, 1);
  assert.equal(result.revenue.netRevenue, '90.00');
  assert.equal(result.occupancy.averageOccupancyPercentage, '40.00');
});
test('staff cannot access financial reports and admin cannot select unassigned journey', async () => {
  await assert.rejects(
    service().getRevenueReport({ actor: { role: 'STAFF' }, ...period }),
    AuthorizationError
  );
  await assert.rejects(
    service().getRevenueReport({ actor: { id: 'a', role: 'ADMIN' }, journeyId: 'j2', ...period }),
    AuthorizationError
  );
});
