'use strict';
const express = require('express');
const createBookingRouter = require('../modules/bookings/booking.routes');
const AuthenticationError = require('../common/errors/AuthenticationError');
const requirePasswordChanged = require('../common/middleware/require-password-change.middleware');
const { createPassengerPaymentRouter } = require('../modules/payments/payment.routes');
const { createPassengerWaitlistRouter } = require('../modules/waitlist/waitlist.routes');
const {
  createPassengerNotificationRouter,
} = require('../modules/notifications/notification.routes');

function requirePassenger(req, res, next) {
  void res;
  if (!req.user) return next(new AuthenticationError());
  return next();
}
function createPassengerRouter(services) {
  const router = express.Router();
  router.use(requirePassenger);
  router.use(requirePasswordChanged);
  router.use(createPassengerPaymentRouter(services));
  router.use(createPassengerWaitlistRouter(services));
  router.use(createPassengerNotificationRouter(services));
  router.use(createBookingRouter(services));
  return router;
}
module.exports = createPassengerRouter;
