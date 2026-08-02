'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { ActiveSeatAllocation } = require('../../models');
class ActiveSeatAllocationRepository extends BaseRepository {
  constructor() {
    super(ActiveSeatAllocation);
  }
  findByBookingSeat(bookingSeatId, options = {}) {
    return this.findOne({ bookingSeatId }, options);
  }
  findConflicts(journeyId, seatId, originSequence, destinationSequence, options = {}) {
    return this.findAll(
      {
        journeyId,
        seatId,
        occupiedSegment: { [Op.overlap]: [originSequence, destinationSequence] },
      },
      options
    );
  }
  findExpiredHolds(referenceDate = new Date(), options = {}) {
    return this.findAll(
      { allocationType: 'HELD', expiresAt: { [Op.lte]: referenceDate } },
      options
    );
  }
  lockConflicts(journeyId, seatId, originSequence, destinationSequence, transaction) {
    return this.findConflicts(journeyId, seatId, originSequence, destinationSequence, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }
  async updateByBooking(bookingId, values, options = {}) {
    const { BookingSeat } = require('../../models');
    const bookingSeats = await BookingSeat.findAll({
      ...options,
      where: { bookingId },
      attributes: ['id'],
    });
    return this.model.update(values, {
      ...options,
      where: { bookingSeatId: { [Op.in]: bookingSeats.map((seat) => seat.id) } },
    });
  }
  async deleteByBooking(bookingId, options = {}) {
    const { BookingSeat } = require('../../models');
    const bookingSeats = await BookingSeat.findAll({
      ...options,
      where: { bookingId },
      attributes: ['id'],
    });
    return this.model.destroy({
      ...options,
      where: { bookingSeatId: { [Op.in]: bookingSeats.map((seat) => seat.id) } },
    });
  }
  deleteExpiredHoldsForSeats(journeyId, seatIds, transaction, referenceDate = new Date()) {
    return this.model.destroy({
      transaction,
      where: {
        journeyId,
        seatId: { [Op.in]: seatIds },
        allocationType: 'HELD',
        expiresAt: { [Op.lte]: referenceDate },
      },
    });
  }
}
module.exports = ActiveSeatAllocationRepository;
