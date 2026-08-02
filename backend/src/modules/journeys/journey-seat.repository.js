'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { JourneySeat, Seat, JourneyCoach } = require('../../models');
class JourneySeatRepository extends BaseRepository {
  constructor() {
    super(JourneySeat);
  }
  findByJourney(journeyId, options = {}) {
    return this.findAll({ journeyId }, options);
  }
  findAvailableByJourney(journeyId, options = {}) {
    return this.findAll(
      { journeyId, status: 'AVAILABLE' },
      {
        ...options,
        include: options.include || [
          { model: Seat, as: 'seat' },
          { model: JourneyCoach, as: 'journeyCoach' },
        ],
      }
    );
  }
  findByJourneyAndSeat(journeyId, seatId, options = {}) {
    return this.findOne({ journeyId, seatId }, options);
  }
}
module.exports = JourneySeatRepository;
