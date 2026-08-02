'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Coach, Seat } = require('../../models');
class CoachRepository extends BaseRepository {
  constructor() {
    super(Coach);
  }
  findByTrain(trainId, options = {}) {
    return this.findAll(
      { trainId },
      { ...options, order: options.order || [['positionNumber', 'ASC']] }
    );
  }
  findByTrainAndNumber(trainId, coachNumber, options = {}) {
    return this.findOne({ trainId, coachNumber }, options);
  }
  findWithSeats(id, options = {}) {
    const { activeSeatsOnly, ...queryOptions } = options;
    return this.model.findByPk(id, {
      ...queryOptions,
      include: [
        {
          model: Seat,
          as: 'seats',
          where: activeSeatsOnly ? { isActive: true } : undefined,
          required: false,
        },
      ],
      order: [[{ model: Seat, as: 'seats' }, 'seatNumber', 'ASC']],
    });
  }
}
module.exports = CoachRepository;
