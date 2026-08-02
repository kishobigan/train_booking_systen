'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { validateReportQuery } = require('./report.validator');
class ReportController {
  constructor({ reportService }) {
    this.service = reportService;
  }
  input(req) {
    return {
      actor: req.user,
      ...validateReportQuery({
        ...req.query,
        journeyId: req.params.journeyId || req.query.journeyId,
      }),
    };
  }
  getDashboard = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.service.getDashboardSummary(this.input(req))))
  );
  getReports = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.service.getReportsSummary(this.input(req))))
  );
  getRevenue = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.service.getRevenueReport(this.input(req))))
  );
  getOccupancy = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.service.getOccupancyReport(this.input(req))))
  );
  getJourneyDashboard = this.getDashboard;
  getJourneyRevenue = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.service.getJourneyRevenue(this.input(req))))
  );
  getJourneyOccupancy = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.service.getJourneyOccupancy(this.input(req))))
  );
}
module.exports = ReportController;
