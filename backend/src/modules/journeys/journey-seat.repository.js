'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { JourneySeat, Seat, JourneyCoach, Journey, Route } = require('../../models');
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
  findByIdWithCoach(id, options = {}) {
    return this.findById(id, {
      ...options,
      include: options.include || [
        { model: Seat, as: 'seat' },
        { model: JourneyCoach, as: 'journeyCoach' },
        {
          model: Journey,
          as: 'journey',
          include: [{ model: Route, as: 'route' }],
        },
      ],
    });
  }
  deleteByJourney(journeyId, options = {}) {
    return this.model.destroy({ ...options, where: { journeyId } });
  }
}
module.exports = JourneySeatRepository;
