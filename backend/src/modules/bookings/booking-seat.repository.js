'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { BookingSeat, Seat, JourneySeat, ActiveSeatAllocation } = require('../../models');
class BookingSeatRepository extends BaseRepository {
  constructor() {
    super(BookingSeat);
  }
  findByBooking(bookingId, options = {}) {
    return this.findAll(
      { bookingId },
      {
        ...options,
        include: options.include || [
          { model: Seat, as: 'seat' },
          { model: JourneySeat, as: 'journeySeat' },
          { model: ActiveSeatAllocation, as: 'activeAllocation' },
        ],
      }
    );
  }
  findByJourneyAndSegment(journeyId, originSequence, destinationSequence, options = {}) {
    return this.findAll(
      { journeyId, occupiedSegment: { [Op.overlap]: [originSequence, destinationSequence] } },
      options
    );
  }
  findForUpdate(id, transaction) {
    return this.findById(id, { transaction, lock: transaction.LOCK.UPDATE });
  }
}
module.exports = BookingSeatRepository;
