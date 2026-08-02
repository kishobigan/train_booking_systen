'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  foreignKey,
  id,
  modelOptions,
  requiredDecimal,
  string,
} = require('../database/common-fields');
class JourneyStation extends Model {
  static initModel(sequelize) {
    JourneyStation.init(
      {
        id: id(),
        journeyId: foreignKey(),
        stationId: foreignKey(),
        sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
        distanceFromStartKm: requiredDecimal(8, 2, { validate: { min: 0 } }),
        scheduledArrivalAt: { type: DataTypes.DATE },
        scheduledDepartureAt: { type: DataTypes.DATE },
        actualArrivalAt: { type: DataTypes.DATE },
        actualDepartureAt: { type: DataTypes.DATE },
        platformNumber: string(20),
        canBoard: boolean(true),
        canAlight: boolean(true),
      },
      modelOptions(sequelize, 'journey_stations', { timestamps: true, updatedAt: false })
    );
    return JourneyStation;
  }
  static associate(models) {
    JourneyStation.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
    JourneyStation.belongsTo(models.Station, { as: 'station', foreignKey: 'stationId' });
    JourneyStation.hasMany(models.Booking, {
      as: 'originBookings',
      foreignKey: 'originJourneyStationId',
    });
    JourneyStation.hasMany(models.Booking, {
      as: 'destinationBookings',
      foreignKey: 'destinationJourneyStationId',
    });
    JourneyStation.hasMany(models.WaitlistEntry, {
      as: 'originWaitlistEntries',
      foreignKey: 'originJourneyStationId',
    });
    JourneyStation.hasMany(models.WaitlistEntry, {
      as: 'destinationWaitlistEntries',
      foreignKey: 'destinationJourneyStationId',
    });
  }
}
module.exports = JourneyStation;
