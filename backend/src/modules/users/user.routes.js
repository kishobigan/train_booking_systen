'use strict';
const express = require('express');
const UserController = require('./user.controller');
const authorize = require('../../common/middleware/authorize.middleware');
const requirePasswordChanged = require('../../common/middleware/require-password-change.middleware');
function routes(services, mode) {
  const router = express.Router();
  const c = new UserController(services);
  router.use(requirePasswordChanged);
  if (mode === 'super') {
    router.use(authorize('SUPER_ADMIN'));
    router.post('/users', c.createUser);
    router.get('/users', c.list);
    router.get('/users/:userId', c.get);
    router.patch('/users/:userId', c.update);
    router.post('/users/:userId/block', c.block);
    router.post('/users/:userId/unblock', c.unblock);
    router.post('/users/:userId/reset-password', c.resetPassword);
    router.patch('/users/:userId/role', c.assignRole);
    router.post('/admins/:adminId/journeys', c.assignJourney);
    router.get('/admins/:adminId/journeys', c.listJourneys);
    router.delete('/admins/:adminId/journeys/:journeyId', c.removeJourney);
  } else {
    router.use(authorize('ADMIN', 'SUPER_ADMIN'));
    router.post('/staff', c.createStaff);
    router.get('/staff', c.listStaff);
    router.get('/staff/:staffId', c.get);
    router.patch('/staff/:staffId', c.update);
    router.post('/staff/:staffId/block', c.block);
    router.post('/staff/:staffId/unblock', c.unblock);
    router.post('/staff/:staffId/reset-password', c.resetPassword);
    router.post('/staff/:staffId/stations', c.assignStation);
    router.get('/staff/:staffId/stations', c.listStations);
    router.delete('/staff/:staffId/stations/:stationId', c.removeStation);
  }
  return router;
}
module.exports = {
  createSuperAdminRouter: (s) => routes(s, 'super'),
  createAdminUserRouter: (s) => routes(s, 'admin'),
};
