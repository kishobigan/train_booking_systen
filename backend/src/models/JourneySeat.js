'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredString,
} = require('../database/common-fields');
const SEAT_STATUS = require('../common/constants/seat-status.constants');
class JourneySeat extends Model {
  static initModel(sequelize) {
    JourneySeat.init(
      {
        id: id(),
        journeyId: foreignKey(),
        journeyCoachId: foreignKey(),
        seatId: foreignKey(),
        seatNumberSnapshot: requiredString(20),
        status: enumType(SEAT_STATUS, { defaultValue: SEAT_STATUS.AVAILABLE }),
        blockedReason: { type: DataTypes.TEXT },
      },
      modelOptions(sequelize, 'journey_seats', { timestamps: true })
    );
    return JourneySeat;
  }
  static associate(models) {
    JourneySeat.belongsTo(models.Journey, { as: 'journey', foreignKey: 'journeyId' });
    JourneySeat.belongsTo(models.JourneyCoach, {
      as: 'journeyCoach',
      foreignKey: 'journeyCoachId',
    });
    JourneySeat.belongsTo(models.Seat, { as: 'seat', foreignKey: 'seatId' });
    JourneySeat.hasMany(models.BookingSeat, { as: 'bookingSeats', foreignKey: 'journeySeatId' });
  }
}
module.exports = JourneySeat;
