'use strict';
const { Model } = require('sequelize');
const { DataTypes, enumType, foreignKey, id, modelOptions } = require('../database/common-fields');
const BOOKING_STATUS = require('../common/constants/booking-status.constants');
class ActiveSeatAllocation extends Model {
  static initModel(sequelize) {
    ActiveSeatAllocation.init(
      {
        id: id(),
        bookingSeatId: foreignKey({ unique: true }),
        journeyId: foreignKey(),
        seatId: foreignKey(),
        occupiedSegment: { type: DataTypes.RANGE(DataTypes.INTEGER), allowNull: false },
        allocationType: enumType(BOOKING_STATUS, {
          validate: { isIn: [[BOOKING_STATUS.HELD, BOOKING_STATUS.CONFIRMED]] },
        }),
        expiresAt: { type: DataTypes.DATE },
      },
      modelOptions(sequelize, 'active_seat_allocations', { timestamps: true, updatedAt: false })
    );
    return ActiveSeatAllocation;
  }
  static associate(models) {
    ActiveSeatAllocation.belongsTo(models.BookingSeat, {
      as: 'bookingSeat',
      foreignKey: 'bookingSeatId',
    });
    ActiveSeatAllocation.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
    ActiveSeatAllocation.belongsTo(models.Seat, { as: 'seat', foreignKey: 'seatId' });
  }
}
module.exports = ActiveSeatAllocation;
