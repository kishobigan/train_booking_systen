'use strict';
const { Model } = require('sequelize');
const { DataTypes, boolean, foreignKey, id, modelOptions } = require('../database/common-fields');
class StaffStation extends Model {
  static initModel(sequelize) {
    StaffStation.init(
      {
        id: id(),
        staffUserId: foreignKey(),
        stationId: foreignKey(),
        assignedByUserId: foreignKey(),
        assignedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        isActive: boolean(true),
        revokedAt: { type: DataTypes.DATE },
        revokedByUserId: { type: DataTypes.UUID },
        revocationReason: { type: DataTypes.TEXT },
      },
      modelOptions(sequelize, 'staff_stations', { timestamps: true })
    );
    return StaffStation;
  }
  static associate(models) {
    StaffStation.belongsTo(models.User, { as: 'staff', foreignKey: 'staffUserId' });
    StaffStation.belongsTo(models.User, { as: 'assignedBy', foreignKey: 'assignedByUserId' });
    StaffStation.belongsTo(models.User, { as: 'revokedBy', foreignKey: 'revokedByUserId' });
    StaffStation.belongsTo(models.Station, { as: 'station', foreignKey: 'stationId' });
  }
}
module.exports = StaffStation;
