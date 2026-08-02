'use strict';
const { Model } = require('sequelize');
const { DataTypes, enumType, foreignKey, id, modelOptions } = require('../database/common-fields');
const BOOKING_STATUS = require('../common/constants/booking-status.constants');
class ActiveSeatAllocation extends Model {
  static initModel(sequelize) {
    ActiveSeatAllocation.init(
      {
        id: id(),
        bookingSeatId: { type: DataTypes.UUID, unique: true },
        waitlistEntryId: { type: DataTypes.UUID },
        journeySeatId: { type: DataTypes.UUID },
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
    ActiveSeatAllocation.belongsTo(models.WaitlistEntry, {
      as: 'waitlistEntry',
      foreignKey: 'waitlistEntryId',
    });
    ActiveSeatAllocation.belongsTo(models.JourneySeat, {
      as: 'journeySeat',
      foreignKey: 'journeySeatId',
    });
  }
}
module.exports = ActiveSeatAllocation;
