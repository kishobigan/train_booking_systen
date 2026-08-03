'use strict';
const express = require('express');
const RouteController = require('./route.controller');
const authorize = require('../../common/middleware/authorize.middleware');
const requirePasswordChanged = require('../../common/middleware/require-password-change.middleware');
function createRouteReadRouter(services) {
  const router = express.Router();
  const controller = new RouteController(services.routeService);
  router.get('/', controller.list);
  router.get('/:routeId', controller.details);
  return router;
}
function createRouteAdminRouter(services) {
  const router = express.Router();
  const controller = new RouteController(services.routeService);
  router.use(requirePasswordChanged, authorize('SUPER_ADMIN'));
  router.post('/', controller.create);
  router.patch('/:routeId', controller.update);
  router.delete('/:routeId', controller.remove);
  router.post('/:routeId/stations', controller.addStation);
  router.post('/:routeId/clone-reverse', controller.cloneReverse);
  router.patch('/:routeId/stations/reorder', controller.reorderStations);
  router.patch('/:routeId/stations/:routeStationId', controller.updateRouteStation);
  router.delete('/:routeId/stations/:routeStationId', controller.removeStation);
  return router;
}
module.exports = { createRouteReadRouter, createRouteAdminRouter };
