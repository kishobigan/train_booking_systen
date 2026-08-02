'use strict';
const express = require('express');
const AvailabilityController = require('./availability.controller');
function createAvailabilityRouter(service) {
  const router = express.Router({ mergeParams: true });
  const controller = new AvailabilityController(service);
  router.get('/', controller.getAvailableSeats);
  router.get('/seats', controller.getSeatAvailability);
  router.get('/coaches', controller.getCoachAvailability);
  router.get('/summary', controller.getSummary);
  return router;
}
function createCoachAvailabilityRouter(service) {
  const router = express.Router({ mergeParams: true });
  const controller = new AvailabilityController(service);
  router.get('/', controller.getCoachAvailability);
  return router;
}
function createTimelineRouter(service) {
  const router = express.Router({ mergeParams: true });
  const controller = new AvailabilityController(service);
  router.get('/', controller.getTimeline);
  return router;
}
module.exports = { createAvailabilityRouter, createCoachAvailabilityRouter, createTimelineRouter };
