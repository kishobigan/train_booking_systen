'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  foreignKey,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
class Seat extends Model {
  static initModel(sequelize) {
    Seat.init(
      {
        id: id(),
        coachId: foreignKey(),
        seatNumber: requiredString(20),
        rowNumber: { type: DataTypes.INTEGER, validate: { min: 1 } },
        columnNumber: { type: DataTypes.INTEGER, validate: { min: 1 } },
        seatType: string(50),
        isWindow: boolean(false),
        isAisle: boolean(false),
        isAccessible: boolean(false),
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'seats', { timestamps: true })
    );
    return Seat;
  }
  static associate(models) {
    Seat.belongsTo(models.Coach, { as: 'coach', foreignKey: 'coachId' });
    Seat.hasMany(models.JourneySeat, { as: 'journeySeats', foreignKey: 'seatId' });
    Seat.hasMany(models.BookingPassenger, {
      as: 'passengerAssignments',
      foreignKey: 'assignedSeatId',
    });
    Seat.hasMany(models.BookingSeat, { as: 'bookingSeats', foreignKey: 'seatId' });
    Seat.hasMany(models.ActiveSeatAllocation, {
      as: 'activeSeatAllocations',
      foreignKey: 'seatId',
    });
    Seat.hasMany(models.WaitlistEntry, { as: 'waitlistOffers', foreignKey: 'offeredSeatId' });
  }
}
module.exports = Seat;
