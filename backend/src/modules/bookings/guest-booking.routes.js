'use strict';
const express = require('express');
const BookingController = require('./booking.controller');
const guestAuthFactory = require('./guest-booking.middleware');
function createPublicBookingRouter(services) {
  const router = express.Router();
  const controller = new BookingController(services);
  router.post('/bookings/hold', controller.createGuestHold);
  return router;
}
function createGuestBookingRouter(services) {
  const router = express.Router();
  const controller = new BookingController(services);
  const guestAuth = guestAuthFactory(services);
  router.use('/guest/bookings/:bookingId', guestAuth);
  router.get('/guest/bookings/:bookingId', controller.getGuestById);
  router.get('/guest/bookings/:bookingId/history', controller.getGuestHistory);
  router.get('/guest/bookings/:bookingId/ticket', controller.getGuestTicket);
  router.post('/guest/bookings/:bookingId/cancel', controller.cancelGuestBooking);
  return router;
}
module.exports = { createPublicBookingRouter, createGuestBookingRouter };
