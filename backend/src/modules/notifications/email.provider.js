'use strict';
const nodemailer = require('nodemailer');
const NotificationProviderError = require('../../common/errors/NotificationProviderError');
const defaultConfig = require('../../config/email');
class EmailProvider {
  constructor(config = defaultConfig, transporter) {
    this.config = config;
    this.name = config.provider || 'SMTP';
    this.transporter =
      transporter ||
      (config.enabled
        ? nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: config.smtp.user
              ? { user: config.smtp.user, pass: config.smtp.password }
              : undefined,
          })
        : null);
  }
  async verify() {
    if (!this.config.enabled || !this.transporter) return false;
    return this.transporter.verify();
  }
  async send({ to, subject, html, text, metadata }) {
    if (!this.config.enabled || !this.transporter)
      throw new NotificationProviderError('Email delivery is disabled', {
        retryable: false,
        code: 'EMAIL_DISABLED',
        provider: this.name,
      });
    try {
      const result = await this.transporter.sendMail({
        from: { name: this.config.fromName, address: this.config.fromAddress },
        replyTo: this.config.replyTo,
        to,
        subject,
        html,
        text,
        headers: metadata?.headers,
      });
      return {
        success: true,
        providerReference: result.messageId,
        providerStatus: result.accepted?.length ? 'accepted' : 'queued',
      };
    } catch (error) {
      throw new NotificationProviderError(
        'Temporary email provider failure',
        {
          retryable: !['EENVELOPE', 'EMESSAGE'].includes(error.code),
          code: error.code || 'EMAIL_PROVIDER_FAILED',
          provider: this.name,
        },
        { cause: error }
      );
    }
  }
}
module.exports = EmailProvider;
