'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
class Train extends Model {
  static initModel(sequelize) {
    Train.init(
      {
        id: id(),
        trainNumber: requiredString(30, { unique: true }),
        name: string(150),
        description: { type: DataTypes.TEXT },
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'trains', { timestamps: true })
    );
    return Train;
  }
  static associate(models) {
    Train.hasMany(models.Coach, { as: 'coaches', foreignKey: 'trainId' });
    Train.hasMany(models.Journey, { as: 'journeys', foreignKey: 'trainId' });
  }
}
module.exports = Train;
