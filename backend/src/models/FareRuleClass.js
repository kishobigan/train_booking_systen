'use strict';
const { Model } = require('sequelize');
const {
  decimal,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredDecimal,
} = require('../database/common-fields');
const COACH_CLASS = require('../common/constants/coach-class.constants');
class FareRuleClass extends Model {
  static initModel(sequelize) {
    FareRuleClass.init(
      {
        id: id(),
        fareRuleId: foreignKey(),
        coachClass: enumType(COACH_CLASS),
        baseFareOverride: decimal(10, 2),
        pricePerKmOverride: decimal(10, 4),
        minimumFareOverride: decimal(10, 2),
        multiplier: requiredDecimal(6, 3, { defaultValue: 1, validate: { min: Number.EPSILON } }),
      },
      modelOptions(sequelize, 'fare_rule_classes', { timestamps: true, updatedAt: false })
    );
    return FareRuleClass;
  }
  static associate(models) {
    FareRuleClass.belongsTo(models.FareRule, { as: 'fareRule', foreignKey: 'fareRuleId' });
  }
}
module.exports = FareRuleClass;
