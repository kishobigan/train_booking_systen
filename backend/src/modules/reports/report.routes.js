'use strict';
const express = require('express');
const ReportController = require('./report.controller');
function createReportRouter(services) {
  const router = express.Router();
  const controller = new ReportController(services);
  router.get('/dashboard', controller.getDashboard);
  router.get('/reports', controller.getReports);
  router.get('/reports/revenue', controller.getRevenue);
  router.get('/reports/occupancy', controller.getOccupancy);
  router.get('/journeys/:journeyId/dashboard', controller.getJourneyDashboard);
  router.get('/journeys/:journeyId/revenue', controller.getJourneyRevenue);
  router.get('/journeys/:journeyId/occupancy', controller.getJourneyOccupancy);
  return router;
}
module.exports = createReportRouter;
