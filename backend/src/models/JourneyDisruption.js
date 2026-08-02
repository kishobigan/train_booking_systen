'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  foreignKey,
  id,
  modelOptions,
  requiredString,
} = require('../database/common-fields');
class JourneyDisruption extends Model {
  static initModel(sequelize) {
    JourneyDisruption.init(
      {
        id: id(),
        journeyId: foreignKey(),
        disruptionType: requiredString(50),
        title: requiredString(200),
        description: { type: DataTypes.TEXT },
        affectedFromSequence: { type: DataTypes.INTEGER },
        affectedToSequence: { type: DataTypes.INTEGER },
        startsAt: { type: DataTypes.DATE, allowNull: false },
        endsAt: { type: DataTypes.DATE },
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'journey_disruptions', { timestamps: true, updatedAt: false })
    );
    return JourneyDisruption;
  }
  static associate(models) {
    JourneyDisruption.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
  }
}
module.exports = JourneyDisruption;
