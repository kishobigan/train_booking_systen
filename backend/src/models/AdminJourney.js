'use strict';
const { Model } = require('sequelize');
const { DataTypes, boolean, foreignKey, id, modelOptions } = require('../database/common-fields');
class AdminJourney extends Model {
  static initModel(sequelize) {
    AdminJourney.init(
      {
        id: id(),
        adminUserId: foreignKey(),
        journeyId: foreignKey(),
        assignedByUserId: foreignKey(),
        assignedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'admin_journeys', { timestamps: false })
    );
    return AdminJourney;
  }
  static associate(models) {
    AdminJourney.belongsTo(models.User, { as: 'admin', foreignKey: 'adminUserId' });
    AdminJourney.belongsTo(models.User, { as: 'assignedBy', foreignKey: 'assignedByUserId' });
    AdminJourney.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
  }
}
module.exports = AdminJourney;
