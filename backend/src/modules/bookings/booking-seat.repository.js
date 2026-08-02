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
  findByPassenger(bookingId, bookingPassengerId, options = {}) {
    return this.findOne({ bookingId, bookingPassengerId }, options);
  }
  countByBooking(bookingId, options = {}) {
    return this.count({ bookingId }, options);
  }
  updateStatusesByBooking(bookingId, status, options = {}) {
    return this.model.update({ status }, { ...options, where: { bookingId } });
  }
  deleteByPassenger(bookingId, bookingPassengerId, options = {}) {
    return this.model.destroy({ ...options, where: { bookingId, bookingPassengerId } });
  }
}
module.exports = BookingSeatRepository;
