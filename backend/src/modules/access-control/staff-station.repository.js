'use strict';
const { StaffStation, Station } = require('../../models');
const BaseRepository = require('../../common/repositories/BaseRepository');
class StaffStationRepository extends BaseRepository {
  constructor() {
    super(StaffStation);
  }
  upsert(values, options = {}) {
    return StaffStation.upsert({ ...values, isActive: true }, options);
  }
  findActive(staffUserId, stationId, options = {}) {
    return StaffStation.findOne({ ...options, where: { staffUserId, stationId, isActive: true } });
  }
  list(staffUserId, options = {}) {
    return StaffStation.findAll({
      ...options,
      where: { staffUserId, isActive: true },
      include: [{ model: Station, as: 'station' }],
    });
  }
  remove(staffUserId, stationId, options = {}) {
    return StaffStation.update(
      { isActive: false },
      { ...options, where: { staffUserId, stationId } }
    );
  }
}
module.exports = StaffStationRepository;
