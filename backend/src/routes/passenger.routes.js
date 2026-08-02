'use strict';
const express = require('express');
const BookingController = require('../modules/bookings/booking.controller');
const AuthenticationError = require('../common/errors/AuthenticationError');
const requirePasswordChanged = require('../common/middleware/require-password-change.middleware');
const { createPassengerPaymentRouter } = require('../modules/payments/payment.routes');
const { createPassengerWaitlistRouter } = require('../modules/waitlist/waitlist.routes');

function requirePassenger(req, res, next) {
  void res;
  if (!req.user) return next(new AuthenticationError());
  return next();
}
function createPassengerRouter(services) {
  const router = express.Router();
  const controller = new BookingController(services);
  router.use(requirePassenger);
  router.use(requirePasswordChanged);
  router.use(createPassengerPaymentRouter(services));
  router.use(createPassengerWaitlistRouter(services));
  router.post('/bookings/hold', controller.createHold);
  router.get('/bookings/reference/:reference', controller.getByReference);
  router.get('/bookings', controller.getMyBookings);
  router.post('/bookings/:bookingId/confirm', controller.confirm);
  router.get('/bookings/:bookingId/ticket', controller.getTicket);
  router.get('/bookings/:bookingId', controller.getById);
  router.get('/bookings/:bookingId/status-history', controller.getStatusHistory);
  router.post('/bookings/:bookingId/cancel', controller.cancelBooking);
  return router;
}
module.exports = createPassengerRouter;
