'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { JourneyCoach, JourneySeat, Coach } = require('../../models');
class JourneyCoachRepository extends BaseRepository {
  constructor() {
    super(JourneyCoach);
  }
  findByJourney(journeyId, options = {}) {
    return this.findAll(
      { journeyId },
      { ...options, order: options.order || [['positionNumber', 'ASC']] }
    );
  }
  findAvailableByJourney(journeyId, options = {}) {
    return this.findAll(
      { journeyId, isAvailable: true },
      { ...options, order: options.order || [['positionNumber', 'ASC']] }
    );
  }
  findWithSeats(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [
        { model: Coach, as: 'coach' },
        { model: JourneySeat, as: 'journeySeats' },
      ],
    });
  }
  deleteByJourney(journeyId, options = {}) {
    return this.model.destroy({ ...options, where: { journeyId } });
  }
}
module.exports = JourneyCoachRepository;
