'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredString,
} = require('../database/common-fields');
const JOURNEY_STATUS = require('../common/constants/journey-status.constants');
class Journey extends Model {
  static initModel(sequelize) {
    Journey.init(
      {
        id: id(),
        routeId: foreignKey(),
        trainId: foreignKey(),
        serviceNumber: requiredString(30),
        journeyDate: { type: DataTypes.DATEONLY, allowNull: false },
        scheduledDepartureAt: { type: DataTypes.DATE, allowNull: false },
        scheduledArrivalAt: { type: DataTypes.DATE },
        actualDepartureAt: { type: DataTypes.DATE },
        actualArrivalAt: { type: DataTypes.DATE },
        status: enumType(JOURNEY_STATUS, { defaultValue: JOURNEY_STATUS.SCHEDULED }),
        bookingOpensAt: { type: DataTypes.DATE },
        bookingClosesAt: { type: DataTypes.DATE },
      },
      modelOptions(sequelize, 'journeys', { timestamps: true })
    );
    return Journey;
  }
  static associate(models) {
    Journey.belongsTo(models.Route, { as: 'route', foreignKey: 'routeId' });
    Journey.belongsTo(models.Train, { as: 'train', foreignKey: 'trainId' });
    Journey.hasMany(models.JourneyStation, { as: 'journeyStations', foreignKey: 'journeyId' });
    Journey.hasMany(models.JourneyCoach, { as: 'journeyCoaches', foreignKey: 'journeyId' });
    Journey.hasMany(models.JourneySeat, { as: 'journeySeats', foreignKey: 'journeyId' });
    Journey.hasMany(models.Booking, { as: 'bookings', foreignKey: 'journeyId' });
    Journey.hasMany(models.BookingSeat, { as: 'bookingSeats', foreignKey: 'journeyId' });
    Journey.hasMany(models.ActiveSeatAllocation, {
      as: 'activeSeatAllocations',
      foreignKey: 'journeyId',
    });
    Journey.hasMany(models.WaitlistEntry, { as: 'waitlistEntries', foreignKey: 'journeyId' });
    Journey.hasMany(models.Notification, { as: 'notifications', foreignKey: 'journeyId' });
    Journey.hasMany(models.JourneyDisruption, { as: 'disruptions', foreignKey: 'journeyId' });
    Journey.belongsToMany(models.User, {
      as: 'assignedAdmins',
      through: models.AdminJourney,
      foreignKey: 'journeyId',
      otherKey: 'adminUserId',
    });
  }
  isBookableAt(date = new Date()) {
    return (
      this.status === JOURNEY_STATUS.SCHEDULED &&
      (!this.bookingOpensAt || this.bookingOpensAt <= date) &&
      (!this.bookingClosesAt || this.bookingClosesAt > date)
    );
  }
}
module.exports = Journey;
