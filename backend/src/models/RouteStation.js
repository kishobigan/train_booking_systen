'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  foreignKey,
  id,
  modelOptions,
  requiredDecimal,
} = require('../database/common-fields');
class RouteStation extends Model {
  static initModel(sequelize) {
    RouteStation.init(
      {
        id: id(),
        routeId: foreignKey(),
        stationId: foreignKey(),
        sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
        distanceFromStartKm: requiredDecimal(8, 2, { validate: { min: 0 } }),
        defaultArrivalOffsetMinutes: { type: DataTypes.INTEGER },
        defaultDepartureOffsetMinutes: { type: DataTypes.INTEGER },
        stopDurationMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: { min: 0 },
        },
        canBoard: boolean(true),
        canAlight: boolean(true),
      },
      modelOptions(sequelize, 'route_stations', { timestamps: true, updatedAt: false })
    );
    return RouteStation;
  }
  static associate(models) {
    RouteStation.belongsTo(models.Route, { as: 'route', foreignKey: 'routeId' });
    RouteStation.belongsTo(models.Station, { as: 'station', foreignKey: 'stationId' });
  }
}
module.exports = RouteStation;
