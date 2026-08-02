'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  enumType,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
const CHANNEL = require('../common/constants/notification-channel.constants');
const STATUS = require('../common/constants/notification-status.constants');
class Notification extends Model {
  static initModel(sequelize) {
    Notification.init(
      {
        id: id(),
        userId: { type: DataTypes.UUID },
        bookingId: { type: DataTypes.UUID },
        journeyId: { type: DataTypes.UUID },
        channel: enumType(CHANNEL),
        destination: requiredString(255),
        templateCode: requiredString(100),
        subject: string(255),
        content: { type: DataTypes.TEXT, allowNull: false },
        status: enumType(STATUS, { defaultValue: STATUS.PENDING }),
        providerReference: string(150),
        failureMessage: { type: DataTypes.TEXT },
        attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
        nextRetryAt: { type: DataTypes.DATE },
        lastAttemptAt: { type: DataTypes.DATE },
        processingWorkerId: string(150),
        providerName: string(100),
        failureCode: string(100),
        deduplicationKey: string(255, { unique: true }),
        metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        scheduledAt: { type: DataTypes.DATE },
        sentAt: { type: DataTypes.DATE },
      },
      modelOptions(sequelize, 'notifications', { timestamps: true })
    );
    return Notification;
  }
  static associate(models) {
    Notification.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
    Notification.belongsTo(models.Booking, { as: 'booking', foreignKey: 'bookingId' });
    Notification.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
  }
}
module.exports = Notification;
