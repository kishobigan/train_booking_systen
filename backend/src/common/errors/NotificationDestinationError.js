'use strict';
const NotificationError = require('./NotificationError');
class NotificationDestinationError extends NotificationError {
  constructor(
    message = 'Notification destination is invalid',
    code = 'INVALID_NOTIFICATION_DESTINATION'
  ) {
    super(message, 400, code);
  }
}
module.exports = NotificationDestinationError;
