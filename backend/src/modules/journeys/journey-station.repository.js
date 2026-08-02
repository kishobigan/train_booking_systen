'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { JourneyStation, Station } = require('../../models');
class JourneyStationRepository extends BaseRepository {
  constructor() {
    super(JourneyStation);
  }
  findByJourney(journeyId, options = {}) {
    return this.findAll(
      { journeyId },
      {
        ...options,
        include: options.include || [{ model: Station, as: 'station' }],
        order: options.order || [['sequenceNumber', 'ASC']],
      }
    );
  }
  findByJourneyAndSequence(journeyId, sequenceNumber, options = {}) {
    return this.findOne({ journeyId, sequenceNumber }, options);
  }
  findByJourneyAndStation(journeyId, stationId, options = {}) {
    return this.findOne({ journeyId, stationId }, options);
  }
  findByIdAndJourney(id, journeyId, options = {}) {
    return this.findOne(
      { id, journeyId },
      { ...options, include: options.include || [{ model: Station, as: 'station' }] }
    );
  }
  async findOriginAndDestination(journeyId, originId, destinationId, options = {}) {
    return Promise.all([
      this.findByIdAndJourney(originId, journeyId, options),
      this.findByIdAndJourney(destinationId, journeyId, options),
    ]);
  }
  deleteByJourney(journeyId, options = {}) {
    return this.model.destroy({ ...options, where: { journeyId } });
  }
}
module.exports = JourneyStationRepository;
