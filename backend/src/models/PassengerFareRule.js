'use strict';
const { Model } = require('sequelize');
const {
  boolean,
  enumType,
  id,
  modelOptions,
  requiredDecimal,
} = require('../database/common-fields');
const PASSENGER_TYPE = require('../common/constants/passenger-type.constants');
class PassengerFareRule extends Model {
  static initModel(sequelize) {
    PassengerFareRule.init(
      {
        id: id(),
        passengerType: enumType(PASSENGER_TYPE, { unique: true }),
        discountPercentage: requiredDecimal(5, 2, {
          defaultValue: 0,
          validate: { min: 0, max: 100 },
        }),
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'passenger_fare_rules', { timestamps: true, updatedAt: false })
    );
    return PassengerFareRule;
  }
  static associate() {}
}
module.exports = PassengerFareRule;
