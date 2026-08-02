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
}
module.exports = ActiveSeatAllocationRepository;
