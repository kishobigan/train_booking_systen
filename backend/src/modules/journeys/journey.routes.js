'use strict';
const express = require('express');
const JourneyController = require('./journey.controller');
module.exports = (journeyService) => {
  const router = express.Router();
  const controller = new JourneyController(journeyService);
  router.get('/search', controller.search);
  router.get('/:journeyId', controller.details);
  return router;
};
