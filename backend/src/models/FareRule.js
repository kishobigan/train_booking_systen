'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  id,
  modelOptions,
  requiredDecimal,
  requiredString,
} = require('../database/common-fields');
class FareRule extends Model {
  static initModel(sequelize) {
    FareRule.init(
      {
        id: id(),
        routeId: { type: DataTypes.UUID },
        name: requiredString(150),
        baseFare: requiredDecimal(10, 2, { defaultValue: 0, validate: { min: 0 } }),
        pricePerKm: requiredDecimal(10, 4, { validate: { min: 0 } }),
        minimumFare: requiredDecimal(10, 2, { defaultValue: 0, validate: { min: 0 } }),
        currency: requiredString(3, { defaultValue: 'LKR' }),
        validFrom: { type: DataTypes.DATEONLY, allowNull: false },
        validUntil: { type: DataTypes.DATEONLY },
        priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'fare_rules', { timestamps: true })
    );
    return FareRule;
  }
  static associate(models) {
    FareRule.belongsTo(models.Route, { as: 'route', foreignKey: 'routeId' });
    FareRule.hasMany(models.FareRuleClass, { as: 'fareRuleClasses', foreignKey: 'fareRuleId' });
  }
}
module.exports = FareRule;
