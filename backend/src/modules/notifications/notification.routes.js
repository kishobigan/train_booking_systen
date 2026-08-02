'use strict';
const express = require('express');
const NotificationController = require('./notification.controller');
function createPassengerNotificationRouter(services) {
  const router = express.Router();
  const controller = new NotificationController(services);
  router.get('/notifications', controller.listMine);
  router.get('/notifications/:notificationId', controller.getMine);
  return router;
}
function createAdminNotificationRouter(services) {
  const router = express.Router();
  const controller = new NotificationController(services);
  router.get('/notifications', controller.listAdmin);
  router.get('/notifications/:notificationId', controller.getAdmin);
  router.post('/notifications/:notificationId/retry', controller.retry);
  return router;
}
module.exports = { createPassengerNotificationRouter, createAdminNotificationRouter };
