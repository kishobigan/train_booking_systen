'use strict';
const { randomUUID } = require('node:crypto');
const NotificationProviderError = require('../../common/errors/NotificationProviderError');
const defaultConfig = require('../../config/sms');
class SmsProvider {
  async send() {
    throw new NotificationProviderError('SMS provider is not implemented', {
      retryable: false,
      code: 'SMS_PROVIDER_NOT_IMPLEMENTED',
    });
  }
}
class MockSmsProvider extends SmsProvider {
  constructor(config = defaultConfig) {
    super();
    this.config = config;
    this.name = 'MOCK';
  }
  async send({ to, message }) {
    if (!this.config.enabled && process.env.NODE_ENV === 'production')
      throw new NotificationProviderError('SMS delivery is disabled', {
        retryable: false,
        code: 'SMS_DISABLED',
        provider: this.name,
      });
    return {
      success: true,
      providerReference: `mock-sms-${randomUUID()}`,
      providerStatus: 'accepted',
      to,
      messageLength: message.length,
    };
  }
}
module.exports = SmsProvider;
module.exports.MockSmsProvider = MockSmsProvider;
