'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  decimal,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
class Station extends Model {
  static initModel(sequelize) {
    Station.init(
      {
        id: id(),
        code: requiredString(10, { unique: true }),
        name: requiredString(150),
        localName: string(150),
        city: string(100),
        district: string(100),
        latitude: decimal(9, 6, { validate: { min: -90, max: 90 } }),
        longitude: decimal(9, 6, { validate: { min: -180, max: 180 } }),
        platformCount: { type: DataTypes.INTEGER, validate: { min: 0 } },
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'stations', {
        timestamps: true,
        scopes: { active: { where: { isActive: true } } },
      })
    );
    return Station;
  }
  static associate(models) {
    Station.hasMany(models.StaffStation, { as: 'staffAssignments', foreignKey: 'stationId' });
    Station.hasMany(models.Route, { as: 'startingRoutes', foreignKey: 'startStationId' });
    Station.hasMany(models.Route, { as: 'endingRoutes', foreignKey: 'endStationId' });
    Station.hasMany(models.RouteStation, { as: 'routeStations', foreignKey: 'stationId' });
    Station.hasMany(models.JourneyStation, { as: 'journeyStations', foreignKey: 'stationId' });
    Station.belongsToMany(models.User, {
      as: 'assignedStaff',
      through: models.StaffStation,
      foreignKey: 'stationId',
      otherKey: 'staffUserId',
    });
  }
}
module.exports = Station;
