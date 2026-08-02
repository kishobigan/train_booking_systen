'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Seat } = require('../../models');
class SeatRepository extends BaseRepository {
  constructor() {
    super(Seat);
  }
  findByCoach(coachId, options = {}) {
    return this.findAll(
      { coachId },
      { ...options, order: options.order || [['seatNumber', 'ASC']] }
    );
  }
  findActiveByCoach(coachId, options = {}) {
    return this.findAll(
      { coachId, isActive: true },
      { ...options, order: options.order || [['seatNumber', 'ASC']] }
    );
  }
  findByCoachAndNumber(coachId, seatNumber, options = {}) {
    return this.findOne({ coachId, seatNumber }, options);
  }
  deleteByCoach(coachId, options = {}) {
    return this.model.destroy({ ...options, where: { coachId } });
  }
}
module.exports = SeatRepository;
