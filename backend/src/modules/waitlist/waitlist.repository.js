'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { WaitlistEntry, User, JourneyStation, Seat, Booking } = require('../../models');
const WAITLIST_STATUS = require('../../common/constants/waitlist-status.constants');
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
  findByIdForUpdate(id, transaction) {
    return this.model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  }
  findByUserId(userId, options = {}) {
    return this.findAll({ userId }, { ...options, order: [['createdAt', 'DESC']] });
  }
  findByJourneyId(journeyId, options = {}) {
    return this.findByJourney(journeyId, options);
  }
  findDuplicateActiveEntry(input, options = {}) {
    return this.findOne(
      {
        userId: input.userId,
        journeyId: input.journeyId,
        originSequence: input.originSequence,
        destinationSequence: input.destinationSequence,
        requestedCoachClass: input.requestedCoachClass,
        status: { [Op.in]: [WAITLIST_STATUS.WAITING, WAITLIST_STATUS.OFFERED] },
      },
      options
    );
  }
  findWaitingCandidates(input, options = {}) {
    const where = {
      journeyId: input.journeyId,
      requestedCoachClass: input.coachClass,
      status: WAITLIST_STATUS.WAITING,
    };
    if (input.availableSegments?.length) {
      where[Op.or] = input.availableSegments.map((segment) => ({
        originSequence: { [Op.gte]: segment.originSequence },
        destinationSequence: { [Op.lte]: segment.destinationSequence },
      }));
    }
    if (input.availableSeatCount) where.passengerCount = { [Op.lte]: input.availableSeatCount };
    return this.model.findAll({
      ...options,
      where,
      limit: Math.min(Math.max(Number(input.limit) || 50, 1), 100),
      order: [
        ['priorityNumber', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
  }
  findWaitingCandidateForUpdate(input, transaction) {
    return this.model.findOne({
      where: {
        journeyId: input.journeyId,
        requestedCoachClass: input.coachClass,
        status: WAITLIST_STATUS.WAITING,
        passengerCount: { [Op.lte]: input.availableSeatCount || 1 },
        originSequence: { [Op.gte]: input.originSequence },
        destinationSequence: { [Op.lte]: input.destinationSequence },
      },
      order: [
        ['priorityNumber', 'ASC'],
        ['createdAt', 'ASC'],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
  }
  countCompatibleEntriesAhead(entry, options = {}) {
    return this.count(
      {
        journeyId: entry.journeyId,
        requestedCoachClass: entry.requestedCoachClass,
        passengerCount: { [Op.lte]: entry.passengerCount },
        originSequence: entry.originSequence,
        destinationSequence: entry.destinationSequence,
        status: WAITLIST_STATUS.WAITING,
        [Op.or]: [
          { priorityNumber: { [Op.lt]: entry.priorityNumber } },
          { priorityNumber: entry.priorityNumber, createdAt: { [Op.lt]: entry.createdAt } },
        ],
      },
      options
    );
  }
  updateStatus(entry, status, values = {}, options = {}) {
    return entry.update({ ...values, status }, options);
  }
  findExpiredOffersForUpdate(limit, transaction) {
    return this.model.findAll({
      where: {
        status: WAITLIST_STATUS.OFFERED,
        offerExpiresAt: { [Op.lte]: this.model.sequelize.fn('NOW') },
      },
      order: [['offerExpiresAt', 'ASC']],
      limit: Math.min(Math.max(Number(limit) || 50, 1), 100),
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
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
