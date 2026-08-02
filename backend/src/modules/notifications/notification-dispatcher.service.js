'use strict';
const CHANNEL = require('../../common/constants/notification-channel.constants');
const NotificationError = require('../../common/errors/NotificationError');
class NotificationDispatcherService {
  constructor({ emailProvider, smsProvider }) {
    Object.assign(this, { emailProvider, smsProvider });
  }
  async dispatch(notification) {
    if (notification.channel === CHANNEL.EMAIL) {
      const result = await this.emailProvider.send({
        to: notification.destination,
        subject: notification.subject,
        html: notification.metadata?.html,
        text: notification.content,
        metadata: notification.metadata,
      });
      return { ...result, providerName: this.emailProvider.name };
    }
    if (notification.channel === CHANNEL.SMS) {
      const result = await this.smsProvider.send({
        to: notification.destination,
        message: notification.content,
        metadata: notification.metadata,
      });
      return { ...result, providerName: this.smsProvider.name };
    }
    throw new NotificationError(
      'Unsupported notification channel',
      400,
      'UNSUPPORTED_NOTIFICATION_CHANNEL'
    );
  }
}
module.exports = NotificationDispatcherService;
