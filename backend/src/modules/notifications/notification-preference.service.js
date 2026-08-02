'use strict';
const CHANNEL = require('../../common/constants/notification-channel.constants');
class NotificationPreferenceService {
  constructor(sequelize) {
    this.sequelize = sequelize;
  }
  async get(userId, options = {}) {
    if (!userId) return null;
    const [rows] = await this.sequelize.query(
      'SELECT * FROM notification_preferences WHERE user_id = :userId',
      { replacements: { userId }, ...options }
    );
    return rows[0] || null;
  }
  async isEnabled({ userId, channel, category, mandatory = false }, options = {}) {
    if (mandatory || !userId) return true;
    const preference = await this.get(userId, options);
    if (!preference) return true;
    if (channel === CHANNEL.EMAIL && !preference.email_enabled) return false;
    if (channel === CHANNEL.SMS && !preference.sms_enabled) return false;
    const key = `${category}_enabled`;
    return preference[key] !== false;
  }
}
module.exports = NotificationPreferenceService;
