'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  decimal,
  foreignKey,
  id,
  modelOptions,
  requiredString,
} = require('../database/common-fields');
class Route extends Model {
  static initModel(sequelize) {
    Route.init(
      {
        id: id(),
        code: requiredString(30, { unique: true }),
        name: requiredString(200),
        description: { type: DataTypes.TEXT },
        startStationId: foreignKey(),
        endStationId: foreignKey(),
        totalDistanceKm: decimal(8, 2, { validate: { min: Number.EPSILON } }),
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'routes', { timestamps: true })
    );
    return Route;
  }
  static associate(models) {
    Route.belongsTo(models.Station, { as: 'startStation', foreignKey: 'startStationId' });
    Route.belongsTo(models.Station, { as: 'endStation', foreignKey: 'endStationId' });
    Route.hasMany(models.RouteStation, { as: 'routeStations', foreignKey: 'routeId' });
    Route.hasMany(models.Journey, { as: 'journeys', foreignKey: 'routeId' });
    Route.hasMany(models.FareRule, { as: 'fareRules', foreignKey: 'routeId' });
  }
}
module.exports = Route;
