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
class JourneyCoach extends Model {
  static initModel(sequelize) {
    JourneyCoach.init(
      {
        id: id(),
        journeyId: foreignKey(),
        coachId: foreignKey(),
        coachNumberSnapshot: requiredString(20),
        coachClassSnapshot: enumType(COACH_CLASS),
        reservationTypeSnapshot: enumType(RESERVATION_TYPE),
        positionNumber: { type: DataTypes.INTEGER, allowNull: false },
        isAvailable: boolean(true),
      },
      modelOptions(sequelize, 'journey_coaches', { timestamps: true, updatedAt: false })
    );
    return JourneyCoach;
  }
  static associate(models) {
    JourneyCoach.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
    JourneyCoach.belongsTo(models.Coach, { as: 'coach', foreignKey: 'coachId' });
    JourneyCoach.hasMany(models.JourneySeat, { as: 'journeySeats', foreignKey: 'journeyCoachId' });
  }
}
module.exports = JourneyCoach;
