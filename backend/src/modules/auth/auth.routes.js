'use strict';
const express = require('express');
const AuthController = require('./auth.controller');
const authenticateFactory = require('../../common/middleware/authenticate.middleware');
const requirePasswordChanged = require('../../common/middleware/require-password-change.middleware');
module.exports = (services) => {
  const router = express.Router();
  const controller = new AuthController(services.authService, services.userService);
  const authenticate = authenticateFactory(services.authService);
  router.post('/login', controller.login);
  router.post('/change-initial-password', controller.changeInitialPassword);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', authenticate, controller.logoutAll);
  router.get('/me', authenticate, controller.me);
  router.post('/change-password', authenticate, requirePasswordChanged, controller.changePassword);
  return router;
};
