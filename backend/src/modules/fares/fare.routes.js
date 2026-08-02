'use strict';
const express = require('express');
const FareController = require('./fare.controller');

function createFareRouter(fareCalculationService) {
  const router = express.Router();
  const controller = new FareController(fareCalculationService);
  router.post('/quote', controller.quoteFare);
  return router;
}

module.exports = createFareRouter;
