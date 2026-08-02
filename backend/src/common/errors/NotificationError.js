'use strict';
const AppError = require('./AppError');
class NotificationError extends AppError {
  constructor(
    message = 'Notification operation failed',
    statusCode = 422,
    code = 'NOTIFICATION_ERROR',
    details,
    options
  ) {
    super(message, statusCode, code, details, options);
  }
}
module.exports = NotificationError;
