'use strict';
const { AdminJourney, Journey } = require('../../models');
const BaseRepository = require('../../common/repositories/BaseRepository');
class AdminJourneyRepository extends BaseRepository {
  constructor() {
    super(AdminJourney);
  }
  upsert(values, options = {}) {
    return AdminJourney.upsert({ ...values, isActive: true }, options);
  }
  findActive(adminUserId, journeyId, options = {}) {
    return AdminJourney.findOne({ ...options, where: { adminUserId, journeyId, isActive: true } });
  }
  list(adminUserId, options = {}) {
    return AdminJourney.findAll({
      ...options,
      where: { adminUserId, isActive: true },
      include: [{ model: Journey, as: 'journey' }],
    });
  }
  remove(adminUserId, journeyId, options = {}) {
    return AdminJourney.update(
      { isActive: false },
      { ...options, where: { adminUserId, journeyId } }
    );
  }
}
module.exports = AdminJourneyRepository;
