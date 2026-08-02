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
}
module.exports = JourneyStationRepository;
