'use strict';
const { Model } = require('sequelize');
const { DataTypes, enumType, foreignKey, id, modelOptions } = require('../database/common-fields');
const BOOKING_STATUS = require('../common/constants/booking-status.constants');
class BookingStatusHistory extends Model {
  static initModel(sequelize) {
    BookingStatusHistory.init(
      {
        id: id(),
        bookingId: foreignKey(),
        previousStatus: { type: DataTypes.ENUM(...Object.values(BOOKING_STATUS)) },
        newStatus: enumType(BOOKING_STATUS),
        changedByUserId: { type: DataTypes.UUID },
        reason: { type: DataTypes.TEXT },
        metadata: { type: DataTypes.JSONB },
      },
      modelOptions(sequelize, 'booking_status_history', { timestamps: true, updatedAt: false })
    );
    return BookingStatusHistory;
  }
  static associate(models) {
    BookingStatusHistory.belongsTo(models.Booking, { as: 'booking', foreignKey: 'bookingId' });
    BookingStatusHistory.belongsTo(models.User, {
      as: 'changedByUser',
      foreignKey: 'changedByUserId',
    });
  }
}
module.exports = BookingStatusHistory;
