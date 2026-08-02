'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
const COACH_CLASS = require('../common/constants/coach-class.constants');
const WAITLIST_STATUS = require('../common/constants/waitlist-status.constants');
class WaitlistEntry extends Model {
  static initModel(sequelize) {
    WaitlistEntry.init(
      {
        id: id(),
        journeyId: foreignKey(),
        userId: { type: DataTypes.UUID },
        originJourneyStationId: foreignKey(),
        destinationJourneyStationId: foreignKey(),
        originSequence: { type: DataTypes.INTEGER, allowNull: false },
        destinationSequence: { type: DataTypes.INTEGER, allowNull: false },
        requestedCoachClass: enumType(COACH_CLASS),
        passengerCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          validate: { min: 1 },
        },
        status: enumType(WAITLIST_STATUS, { defaultValue: WAITLIST_STATUS.WAITING }),
        priorityNumber: { type: DataTypes.BIGINT, autoIncrement: true },
        offeredSeatId: { type: DataTypes.UUID },
        offerExpiresAt: { type: DataTypes.DATE },
        convertedBookingId: { type: DataTypes.UUID, unique: true },
        offerAttemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        contactName: requiredString(150),
        contactEmail: { type: DataTypes.CITEXT, validate: { isEmail: true } },
        contactPhone: string(30),
      },
      modelOptions(sequelize, 'waitlist_entries', { timestamps: true })
    );
    return WaitlistEntry;
  }
  static associate(models) {
    WaitlistEntry.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
    WaitlistEntry.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
    WaitlistEntry.belongsTo(models.JourneyStation, {
      as: 'originJourneyStation',
      foreignKey: 'originJourneyStationId',
    });
    WaitlistEntry.belongsTo(models.JourneyStation, {
      as: 'destinationJourneyStation',
      foreignKey: 'destinationJourneyStationId',
    });
    WaitlistEntry.belongsTo(models.Seat, { as: 'offeredSeat', foreignKey: 'offeredSeatId' });
    WaitlistEntry.belongsTo(models.Booking, {
      as: 'convertedBooking',
      foreignKey: 'convertedBookingId',
    });
    WaitlistEntry.hasMany(models.ActiveSeatAllocation, {
      as: 'offerAllocations',
      foreignKey: 'waitlistEntryId',
    });
  }
}
module.exports = WaitlistEntry;
