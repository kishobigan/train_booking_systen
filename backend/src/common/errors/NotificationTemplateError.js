'use strict';
const NotificationError = require('./NotificationError');
class NotificationTemplateError extends NotificationError {
  constructor(message = 'Notification template is invalid', code = 'NOTIFICATION_TEMPLATE_ERROR') {
    super(message, 400, code);
  }
}
module.exports = NotificationTemplateError;
