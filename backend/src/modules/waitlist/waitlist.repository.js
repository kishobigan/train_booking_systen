'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { WaitlistEntry, User, JourneyStation, Seat, Booking } = require('../../models');
class WaitlistRepository extends BaseRepository {
  constructor() {
    super(WaitlistEntry);
  }
  findByJourney(journeyId, options = {}) {
    return this.findAll(
      { journeyId },
      { ...options, order: options.order || [['priorityNumber', 'ASC']] }
    );
  }
  findWaiting(journeyId, options = {}) {
    return this.findAll(
      { journeyId, status: 'WAITING' },
      { ...options, order: options.order || [['priorityNumber', 'ASC']] }
    );
  }
  findExpiredOffers(referenceDate = new Date(), options = {}) {
    return this.findAll(
      { status: 'OFFERED', offerExpiresAt: { [Op.lte]: referenceDate } },
      options
    );
  }
  findNextForUpdate(journeyId, transaction) {
    return this.model.findOne({
      where: { journeyId, status: 'WAITING' },
      order: [['priorityNumber', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
  }
  findDetails(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [
        { model: User, as: 'user' },
        { model: JourneyStation, as: 'originJourneyStation' },
        { model: JourneyStation, as: 'destinationJourneyStation' },
        { model: Seat, as: 'offeredSeat' },
        { model: Booking, as: 'convertedBooking' },
      ],
    });
  }
}
module.exports = WaitlistRepository;
