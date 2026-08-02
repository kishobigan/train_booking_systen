'use strict';
const express = require('express');
const SeatMapController = require('./seatmap.controller');
module.exports = function createSeatMapRouter(service) {
  const router = express.Router({ mergeParams: true });
  const controller = new SeatMapController(service);
  router.get('/', controller.get);
  return router;
};
