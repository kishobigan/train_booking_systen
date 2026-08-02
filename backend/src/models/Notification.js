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
        channel: enumType(CHANNEL),
        destination: requiredString(255),
        templateCode: requiredString(100),
        subject: string(255),
        content: { type: DataTypes.TEXT, allowNull: false },
        status: enumType(STATUS, { defaultValue: STATUS.PENDING }),
        providerReference: string(150),
        failureMessage: { type: DataTypes.TEXT },
        scheduledAt: { type: DataTypes.DATE },
        sentAt: { type: DataTypes.DATE },
      },
      modelOptions(sequelize, 'notifications', { timestamps: true, updatedAt: false })
    );
    return Notification;
  }
  static associate(models) {
    Notification.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
    Notification.belongsTo(models.Booking, { as: 'booking', foreignKey: 'bookingId' });
  }
}
module.exports = Notification;
