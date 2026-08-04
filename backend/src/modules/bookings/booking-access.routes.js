'use strict';

const express = require('express');
const BookingAccessController = require('./booking-access.controller');

function createBookingAccessRouter(services) {
  const router = express.Router();
  const controller = new BookingAccessController(services);
  router.post('/public/booking-access/request', controller.request);
  router.post('/public/booking-access/verify', controller.verify);
  router.get('/public/booking-access/summary', controller.summary);
  router.post('/public/booking-access/end', controller.end);
  return router;
}

module.exports = createBookingAccessRouter;