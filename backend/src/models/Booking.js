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
const BOOKING_STATUS = require('../common/constants/booking-status.constants');

class Booking extends Model {
  static initModel(sequelize) {
    Booking.init(
      {
        id: id(),
        bookingReference: requiredString(30, { unique: true }),
        userId: { type: DataTypes.UUID },
        journeyId: foreignKey(),
        originJourneyStationId: foreignKey(),
        destinationJourneyStationId: foreignKey(),
        originSequence: { type: DataTypes.INTEGER, allowNull: false },
        destinationSequence: { type: DataTypes.INTEGER, allowNull: false },
        contactName: requiredString(150),
        contactEmail: { type: DataTypes.CITEXT, validate: { isEmail: true } },
        contactPhone: string(30),
        passengerCount: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
        subtotal: requiredDecimal(12, 2, { validate: { min: 0 } }),
        discountAmount: requiredDecimal(12, 2, { defaultValue: 0, validate: { min: 0 } }),
        serviceFee: requiredDecimal(12, 2, { defaultValue: 0, validate: { min: 0 } }),
        taxAmount: requiredDecimal(12, 2, { defaultValue: 0, validate: { min: 0 } }),
        totalAmount: requiredDecimal(12, 2, { validate: { min: 0 } }),
        currency: requiredString(3, { defaultValue: 'LKR' }),
        status: enumType(BOOKING_STATUS, { defaultValue: BOOKING_STATUS.PENDING }),
        holdExpiresAt: { type: DataTypes.DATE },
        confirmedAt: { type: DataTypes.DATE },
        cancelledAt: { type: DataTypes.DATE },
        cancellationReason: { type: DataTypes.TEXT },
      },
      modelOptions(sequelize, 'bookings', {
        timestamps: true,
        validate: {
          validSegment() {
            if (this.originSequence >= this.destinationSequence) {
              throw new Error('originSequence must be less than destinationSequence');
            }
          },
        },
      })
    );
    return Booking;
  }

  static associate(models) {
    Booking.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
    Booking.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
    Booking.belongsTo(models.JourneyStation, {
      as: 'originJourneyStation',
      foreignKey: 'originJourneyStationId',
    });
    Booking.belongsTo(models.JourneyStation, {
      as: 'destinationJourneyStation',
      foreignKey: 'destinationJourneyStationId',
    });
    Booking.hasMany(models.BookingPassenger, { as: 'passengers', foreignKey: 'bookingId' });
    Booking.hasMany(models.BookingSeat, { as: 'bookingSeats', foreignKey: 'bookingId' });
    Booking.hasMany(models.Payment, { as: 'payments', foreignKey: 'bookingId' });
    Booking.hasMany(models.Refund, { as: 'refunds', foreignKey: 'bookingId' });
    Booking.hasMany(models.BookingStatusHistory, { as: 'statusHistory', foreignKey: 'bookingId' });
    Booking.hasMany(models.WaitlistEntry, {
      as: 'convertedWaitlistEntries',
      foreignKey: 'convertedBookingId',
    });
    Booking.hasMany(models.Notification, { as: 'notifications', foreignKey: 'bookingId' });
  }

  isHeld() {
    return this.status === BOOKING_STATUS.HELD;
  }

  isConfirmed() {
    return this.status === BOOKING_STATUS.CONFIRMED;
  }

  isHoldExpired(date = new Date()) {
    return this.isHeld() && this.holdExpiresAt && this.holdExpiresAt <= date;
  }
}

module.exports = Booking;
