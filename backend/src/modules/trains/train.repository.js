'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Train, Coach, Seat } = require('../../models');
class TrainRepository extends BaseRepository {
  constructor() {
    super(Train);
  }
  findByNumber(trainNumber, options = {}) {
    return this.findOne({ trainNumber }, options);
  }
  findConfiguration(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [{ model: Coach, as: 'coaches', include: [{ model: Seat, as: 'seats' }] }],
      order: [
        [{ model: Coach, as: 'coaches' }, 'positionNumber', 'ASC'],
        [{ model: Coach, as: 'coaches' }, { model: Seat, as: 'seats' }, 'seatNumber', 'ASC'],
      ],
    });
  }
  findActive(options = {}) {
    return this.findAll({ isActive: true }, options);
  }
}
module.exports = TrainRepository;
