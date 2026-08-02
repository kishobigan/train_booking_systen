'use strict';
const express = require('express');
const {
  createAvailabilityRouter,
  createCoachAvailabilityRouter,
} = require('../modules/availability/availability.routes');
function createPublicRouter(services) {
  const router = express.Router();
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
