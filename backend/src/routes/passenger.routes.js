'use strict';
const express = require('express');
const BookingController = require('../modules/bookings/booking.controller');
const AuthenticationError = require('../common/errors/AuthenticationError');

function requirePassenger(req, res, next) {
  void res;
  if (!req.user) return next(new AuthenticationError());
  return next();
}
function createPassengerRouter(services) {
  const router = express.Router();
  const controller = new BookingController(services);
  router.get('/bookings/:bookingId/status-history', requirePassenger, controller.getStatusHistory);
  router.post('/bookings/:bookingId/cancel', requirePassenger, controller.cancelBooking);
  return router;
}
module.exports = createPassengerRouter;
