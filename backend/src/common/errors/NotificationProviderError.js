'use strict';
const NotificationError = require('./NotificationError');
class NotificationProviderError extends NotificationError {
  constructor(
    message = 'Notification provider failed',
    { retryable = true, code = 'NOTIFICATION_PROVIDER_FAILED', provider } = {},
    options
  ) {
    super(message, 422, code, { retryable, provider }, options);
    this.retryable = retryable;
    this.provider = provider;
  }
}
module.exports = NotificationProviderError;
