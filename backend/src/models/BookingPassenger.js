'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredDecimal,
  requiredString,
  string,
} = require('../database/common-fields');
const PASSENGER_TYPE = require('../common/constants/passenger-type.constants');
class BookingPassenger extends Model {
  static initModel(sequelize) {
    BookingPassenger.init(
      {
        id: id(),
        bookingId: foreignKey(),
        fullName: requiredString(150),
        passengerType: enumType(PASSENGER_TYPE, { defaultValue: PASSENGER_TYPE.ADULT }),
        identityType: string(30),
        identityNumber: string(100),
        dateOfBirth: { type: DataTypes.DATEONLY },
        assignedSeatId: { type: DataTypes.UUID },
        fareBeforeDiscount: requiredDecimal(10, 2, { validate: { min: 0 } }),
        discountAmount: requiredDecimal(10, 2, { defaultValue: 0, validate: { min: 0 } }),
        finalFare: requiredDecimal(10, 2, { validate: { min: 0 } }),
      },
      modelOptions(sequelize, 'booking_passengers', { timestamps: true, updatedAt: false })
    );
    return BookingPassenger;
  }
  static associate(models) {
    BookingPassenger.belongsTo(models.Booking, { as: 'booking', foreignKey: 'bookingId' });
    BookingPassenger.belongsTo(models.Seat, { as: 'assignedSeat', foreignKey: 'assignedSeatId' });
    BookingPassenger.hasMany(models.BookingSeat, {
      as: 'bookingSeats',
      foreignKey: 'bookingPassengerId',
    });
  }
}
module.exports = BookingPassenger;
