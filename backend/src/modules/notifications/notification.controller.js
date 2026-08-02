'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { notificationId } = require('./notification.validator');
const {
  toPassengerNotificationDto,
  toAdminNotificationDto,
  toDeliveryResultDto,
} = require('./notification.dto');
class NotificationController {
  constructor({ notificationService }) {
    this.service = notificationService;
  }
  listMine = asyncHandler(async (req, res) => {
    const rows = await this.service.getUserNotifications(req.user.id);
    res.json(apiResponse.success(rows.map(toPassengerNotificationDto)));
  });
  getMine = asyncHandler(async (req, res) => {
    const item = await this.service.getNotificationById(
      notificationId(req.params.notificationId),
      req.user
    );
    res.json(apiResponse.success(toPassengerNotificationDto(item)));
  });
  listAdmin = asyncHandler(async (req, res) => {
    const page = await this.service.getAdminNotifications(req.user, req.query);
    res.json(
      apiResponse.success({ ...page, rows: page.rows.map((item) => toAdminNotificationDto(item)) })
    );
  });
  getAdmin = asyncHandler(async (req, res) => {
    const item = await this.service.getNotificationById(
      notificationId(req.params.notificationId),
      req.user
    );
    res.json(apiResponse.success(toAdminNotificationDto(item, { detail: true })));
  });
  retry = asyncHandler(async (req, res) => {
    const item = await this.service.retryNotification({
      notificationId: notificationId(req.params.notificationId),
      actor: req.user,
      overrideMaxAttempts: req.user.role === 'SUPER_ADMIN' && req.body.overrideMaxAttempts === true,
    });
    res.json(apiResponse.success(toDeliveryResultDto(item)));
  });
}
module.exports = NotificationController;
