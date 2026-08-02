'use strict';
const CHANNEL = require('../../common/constants/notification-channel.constants');
const NotificationTemplateError = require('../../common/errors/NotificationTemplateError');
const templates = require('./notification.templates');
class NotificationTemplateService {
  getTemplate(code) {
    const template = templates[code];
    if (!template)
      throw new NotificationTemplateError(
        'Notification template not found',
        'NOTIFICATION_TEMPLATE_NOT_FOUND'
      );
    return template;
  }
  validateVariables(code, variables = {}) {
    const template = this.getTemplate(code);
    const missing = template.requiredVariables.filter(
      (key) => variables[key] === undefined || variables[key] === null || variables[key] === ''
    );
    if (missing.length)
      throw new NotificationTemplateError(
        `Missing template variables: ${missing.join(', ')}`,
        'NOTIFICATION_TEMPLATE_VARIABLE_MISSING'
      );
    return true;
  }
  renderEmail(code, variables) {
    const template = this.getTemplate(code);
    if (!template.email) throw new NotificationTemplateError('Template does not support email');
    this.validateVariables(code, variables);
    return {
      subject: this.#render(template.email.subject, variables, false),
      text: this.#render(template.email.text, variables, false),
      html: this.#render(template.email.html, variables, true),
    };
  }
  renderSms(code, variables) {
    const template = this.getTemplate(code);
    if (!template.sms) throw new NotificationTemplateError('Template does not support SMS');
    this.validateVariables(code, variables);
    return { text: this.#render(template.sms.text, variables, false) };
  }
  render(code, channel, variables) {
    if (channel === CHANNEL.EMAIL) return this.renderEmail(code, variables);
    if (channel === CHANNEL.SMS) return this.renderSms(code, variables);
    throw new NotificationTemplateError('Unsupported notification channel');
  }
  escapeHtml(value) {
    return String(value).replace(
      /[&<>'"]/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]
    );
  }
  #render(source, variables, html) {
    const output = source.replace(/{{\s*([\w]+)\s*}}/g, (match, key) => {
      if (!(key in variables)) return match;
      return html ? this.escapeHtml(variables[key]) : String(variables[key]);
    });
    if (/{{[^}]+}}/.test(output))
      throw new NotificationTemplateError('Template contains unresolved placeholders');
    return output;
  }
}
module.exports = NotificationTemplateService;
