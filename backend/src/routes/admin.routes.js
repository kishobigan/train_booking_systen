'use strict';
const express = require('express');
const BookingController = require('../modules/bookings/booking.controller');
const { createTimelineRouter } = require('../modules/availability/availability.routes');
const AuthenticationError = require('../common/errors/AuthenticationError');
const AuthorizationError = require('../common/errors/AuthorizationError');

function requireAdmin(req, res, next) {
  void res;
  if (!req.user) return next(new AuthenticationError());
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return next(new AuthorizationError('Administrator access is required'));
  }
  return next();
}
function createAdminRouter(services) {
  const router = express.Router();
  const controller = new BookingController(services);
  router.use(requireAdmin);
  router.patch('/bookings/:bookingId/status', controller.updateStatus);
  router.get('/journeys/:journeyId/bookings', controller.getJourneyBookings);
  router.post('/bookings/:bookingId/complete', controller.completeBooking);
  router.post('/bookings/:bookingId/cancel', controller.cancelBooking);
  router.use(
    '/journeys/:journeyId/seats/:journeySeatId/timeline',
    createTimelineRouter(services.seatAvailabilityService)
  );
  return router;
}
module.exports = createAdminRouter;
