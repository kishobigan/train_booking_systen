'use strict';
const express = require('express');
const {
  createAvailabilityRouter,
  createCoachAvailabilityRouter,
} = require('../modules/availability/availability.routes');
const createStationRouter = require('../modules/stations/station.routes');
const { createRouteReadRouter } = require('../modules/routes/route.routes');
const createJourneyRouter = require('../modules/journeys/journey.routes');
function createPublicRouter(services) {
  const router = express.Router();
  router.use('/stations', createStationRouter(services.stationService));
  router.use('/routes', createRouteReadRouter(services));
  router.use('/journeys', createJourneyRouter(services.journeyService));
  router.use(
    '/journeys/:journeyId/availability',
    createAvailabilityRouter(services.seatAvailabilityService)
  );
  router.use(
    '/journeys/:journeyId/coaches/availability',
    createCoachAvailabilityRouter(services.seatAvailabilityService)
  );
  return router;
}
module.exports = createPublicRouter;
