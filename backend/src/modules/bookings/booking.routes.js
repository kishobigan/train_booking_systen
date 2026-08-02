'use strict';
const express = require('express');
const BookingController = require('./booking.controller');
function createBookingRouter(services) {
  const router = express.Router();
  const controller = new BookingController(services);
  router.post('/bookings/hold', controller.createHold);
  router.get('/bookings/reference/:reference', controller.getByReference);
  router.get('/bookings', controller.getMyBookings);
  router.post('/bookings/:bookingId/confirm', controller.confirm);
  router.post('/bookings/:bookingId/cancel', controller.cancelBooking);
  router.get('/bookings/:bookingId/history', controller.getStatusHistory);
  router.get('/bookings/:bookingId/status-history', controller.getStatusHistory);
  router.get('/bookings/:bookingId/ticket', controller.getTicket);
  router.get('/bookings/:bookingId', controller.getById);
  return router;
}
module.exports = createBookingRouter;
