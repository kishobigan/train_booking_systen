'use strict';
const AuthorizationError = require('../../common/errors/AuthorizationError');
const { decimal, subtract } = require('./report.dto');

class ReportService {
  constructor({ reportRepository, accessControlService, trainScopeAuthorizationService, stationScopeAuthorizationService }) {
    this.repository = reportRepository;
    this.accessControlService = accessControlService;
    this.trainScopeAuthorizationService = trainScopeAuthorizationService;
    this.stationScopeAuthorizationService = stationScopeAuthorizationService;
  }

  async resolveReportScope({ actor, journeyId, dateFrom, dateTo }) {
    if (!['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(actor?.role))
      throw new AuthorizationError('Operational reports require internal access');
    let journeyIds = [];
    if (actor.role === 'SUPER_ADMIN') {
      if (journeyId) journeyIds = [journeyId];
    } else if (actor.role === 'ADMIN') {
      const trainIds = await this.trainScopeAuthorizationService.getAccessibleTrainIds(actor);
      journeyIds = await this.repository.findJourneyIdsByTrainIds(trainIds);
      if (journeyId) {
        await this.accessControlService.assertAdminJourneyAccess({ actor, journeyId });
        journeyIds = [journeyId];
      }
    } else {
      const stationIds = await this.stationScopeAuthorizationService.getAccessibleStationIds(actor);
      journeyIds = await this.repository.findJourneyIdsByStationIds(stationIds);
      if (journeyId) {
        await this.stationScopeAuthorizationService.assertJourneyAccess(actor, journeyId);
        journeyIds = [journeyId];
      }
    }
    return {
      allJourneys: actor.role === 'SUPER_ADMIN' && !journeyId,
      journeyIds,
      dateFrom,
      dateToExclusive: new Date(dateTo.getTime() + 86400000),
      scopeType: actor.role === 'SUPER_ADMIN' && !journeyId ? 'SYSTEM' : actor.role === 'STAFF' ? 'ASSIGNED_STATIONS' : 'ASSIGNED_TRAINS',
    };
  }

  async getDashboardSummary(input) {
    const scope = await this.resolveReportScope(input);
    const [bookings, payments, waitlist, revenue, segments] = await Promise.all([
      this.repository.getBookingStatusCounts(scope),
      this.repository.getPaymentStatusCounts(scope),
      this.repository.getWaitlistStatusCounts(scope),
      this.repository.getRevenueSummary(scope),
      this.repository.getSegmentOccupancy(scope),
    ]);
    const bookingCounts = this.#counts(bookings);
    const paymentCounts = this.#counts(payments);
    const waitlistCounts = this.#counts(waitlist);
    const occupancy = this.#occupancy(segments);
    const gross = decimal(revenue.grossRevenue);
    const refunds = decimal(revenue.refundAmount);
    const paymentTotal = Object.values(paymentCounts).reduce((sum, value) => sum + value, 0);
    return {
      scope: {
        type: scope.scopeType,
        journeyCount: scope.allJourneys ? null : scope.journeyIds.length,
      },
      period: {
        dateFrom: input.dateFrom.toISOString().slice(0, 10),
        dateTo: input.dateTo.toISOString().slice(0, 10),
      },
      bookings: {
        total: Object.values(bookingCounts).reduce((a, b) => a + b, 0),
        ...this.#lowerKeys(bookingCounts),
      },
      payments: {
        ...this.#lowerKeys(paymentCounts),
        paymentSuccessRate: paymentTotal
          ? decimal(((paymentCounts.PAID || 0) * 100) / paymentTotal)
          : '0.00',
      },
      revenue: {
        grossRevenue: gross,
        refundAmount: refunds,
        netRevenue: subtract(gross, refunds),
        currency: 'LKR',
      },
      occupancy: occupancy.summary,
      waitlist: this.#lowerKeys(waitlistCounts),
    };
  }

  getReportsSummary(input) {
    return this.getDashboardSummary(input);
  }

  async getRevenueReport(input) {
    if (input.actor?.role === 'STAFF')
      throw new AuthorizationError('Staff cannot access financial reports');
    const scope = await this.resolveReportScope(input);
    const [totals, byPaymentMethod, byJourney, trend] = await Promise.all([
      this.repository.getRevenueSummary(scope),
      this.repository.getRevenueByPaymentMethod(scope),
      this.repository.getJourneyRevenue(scope),
      this.repository.getRevenueTrend(scope, input.groupBy),
    ]);
    return {
      period: {
        dateFrom: input.dateFrom.toISOString().slice(0, 10),
        dateTo: input.dateTo.toISOString().slice(0, 10),
      },
      totals: {
        grossPaidAmount: decimal(totals.grossRevenue),
        refundAmount: decimal(totals.refundAmount),
        netRevenue: subtract(totals.grossRevenue, totals.refundAmount),
        currency: 'LKR',
      },
      byPaymentMethod,
      byJourney,
      trend: trend.map((item) => ({
        ...item,
        refundAmount: '0.00',
        netRevenue: decimal(item.grossRevenue),
      })),
    };
  }

  async getOccupancyReport(input) {
    const scope = await this.resolveReportScope(input);
    const rows = await this.repository.getSegmentOccupancy(scope);
    return this.#occupancy(rows);
  }
  getJourneyRevenue(input) {
    return this.getRevenueReport(input);
  }
  getJourneyOccupancy(input) {
    return this.getOccupancyReport(input);
  }

  #counts(rows) {
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }
  #lowerKeys(value) {
    return Object.fromEntries(
      Object.entries(value).map(([key, count]) => [key.toLowerCase(), count])
    );
  }
  #occupancy(rows) {
    const segments = rows.map((row) => {
      const total = Number(row.totalSeats);
      const occupied = Number(row.occupiedSeats);
      return {
        journeyId: row.journeyId,
        from: {
          stationId: row.fromStationId,
          code: row.fromCode,
          name: row.fromName,
          sequenceNumber: row.sequenceNumber,
        },
        to: {
          stationId: row.toStationId,
          code: row.toCode,
          name: row.toName,
          sequenceNumber: Number(row.sequenceNumber) + 1,
        },
        occupiedSeats: occupied,
        availableSeats: Math.max(0, total - occupied),
        occupancyPercentage: total ? decimal((occupied * 100) / total) : '0.00',
      };
    });
    const rates = segments.map((item) => Number(item.occupancyPercentage));
    return {
      summary: {
        averageOccupancyPercentage: rates.length
          ? decimal(rates.reduce((a, b) => a + b, 0) / rates.length)
          : '0.00',
        highestOccupancyPercentage: rates.length ? decimal(Math.max(...rates)) : '0.00',
        lowestOccupancyPercentage: rates.length ? decimal(Math.min(...rates)) : '0.00',
      },
      segments,
    };
  }
}
module.exports = ReportService;
