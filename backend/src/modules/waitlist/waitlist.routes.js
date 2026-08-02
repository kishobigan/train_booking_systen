'use strict';

const express = require('express');
const WaitlistController = require('./waitlist.controller');

function createPassengerWaitlistRouter(services) {
  const router = express.Router();
  const controller = new WaitlistController(services);
  router.post('/waitlist', controller.join);
  router.get('/waitlist', controller.listMine);
  router.get('/waitlist/:waitlistEntryId/position', controller.position);
  router.get('/waitlist/:waitlistEntryId', controller.get);
  router.delete('/waitlist/:waitlistEntryId', controller.leave);
  router.post('/waitlist/:waitlistEntryId/accept', controller.accept);
  return router;
}

function createAdminWaitlistRouter(services) {
  const router = express.Router();
  const controller = new WaitlistController(services);
  router.get('/journeys/:journeyId/waitlist', controller.listJourney);
  router.post('/waitlist/:waitlistEntryId/offer', controller.offer);
  router.post('/waitlist/:waitlistEntryId/expire', controller.expire);
  return router;
}

module.exports = { createPassengerWaitlistRouter, createAdminWaitlistRouter };
