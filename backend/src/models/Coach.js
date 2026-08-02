'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredString,
} = require('../database/common-fields');
const COACH_CLASS = require('../common/constants/coach-class.constants');
const RESERVATION_TYPE = require('../common/constants/coach-reservation-type.constants');
class Coach extends Model {
  static initModel(sequelize) {
    Coach.init(
      {
        id: id(),
        trainId: foreignKey(),
        coachNumber: requiredString(20),
        coachClass: enumType(COACH_CLASS),
        reservationType: enumType(RESERVATION_TYPE),
        positionNumber: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
        totalSeats: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: { min: 0 },
        },
        seatLayout: { type: DataTypes.JSONB },
        isActive: boolean(true),
      },
      modelOptions(sequelize, 'coaches', { timestamps: true })
    );
    return Coach;
  }
  static associate(models) {
    Coach.belongsTo(models.Train, { as: 'train', foreignKey: 'trainId' });
    Coach.hasMany(models.Seat, { as: 'seats', foreignKey: 'coachId' });
    Coach.hasMany(models.JourneyCoach, { as: 'journeyCoaches', foreignKey: 'coachId' });
  }
}
module.exports = Coach;
