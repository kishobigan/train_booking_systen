'use strict';
const express = require('express');
const AuthController = require('./auth.controller');
const authenticateFactory = require('../../common/middleware/authenticate.middleware');
const requirePasswordChanged = require('../../common/middleware/require-password-change.middleware');
const {
  authLoginLimiter,
  authRefreshLimiter,
  passwordChangeLimiter,
} = require('../../common/middleware/rate-limit.middleware');
const authConfig = require('../../config/auth');
module.exports = (services) => {
  const router = express.Router();
  const controller = new AuthController({
    authService: services.authService,
    authConfig,
    userService: services.userService,
  });
  const authenticate = authenticateFactory(services.authService);
  router.post('/login', authLoginLimiter, controller.login);
  router.post('/change-initial-password', passwordChangeLimiter, controller.changeInitialPassword);
  router.post('/refresh', authRefreshLimiter, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', authenticate, controller.logoutAll);
  router.get('/me', authenticate, requirePasswordChanged, controller.getCurrentUser);
  router.post('/change-password', authenticate, requirePasswordChanged, controller.changePassword);
  return router;
};
