'use strict';
const express = require('express');
const StationController = require('./station.controller');
module.exports = (stationService) => {
  const router = express.Router();
  const controller = new StationController(stationService);
  router.get('/search', controller.search);
  router.get('/', controller.list);
  router.get('/:stationId', controller.details);
  return router;
};
