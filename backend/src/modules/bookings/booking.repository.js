'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const {
  Booking,
  User,
  Journey,
  JourneyStation,
  BookingPassenger,
  BookingSeat,
  Seat,
  Payment,
} = require('../../models');
class BookingRepository extends BaseRepository {
  constructor() {
    super(Booking);
  }
  findByReference(bookingReference, options = {}) {
    return this.findOne({ bookingReference }, options);
  }
  findByUser(userId, options = {}) {
    return this.findAll(
      { userId },
      { ...options, order: options.order || [['created_at', 'DESC']] }
    );
  }
  findByJourney(journeyId, options = {}) {
    return this.findAll({ journeyId }, options);
  }
  findExpiredHolds(referenceDate = new Date(), options = {}) {
    return this.findAll({ status: 'HELD', holdExpiresAt: { [Op.lte]: referenceDate } }, options);
  }
  findForUpdate(id, transaction) {
    return this.findById(id, { transaction, lock: transaction.LOCK.UPDATE });
  }
  findDetails(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [
        { model: User, as: 'user' },
        { model: Journey, as: 'journey' },
        { model: JourneyStation, as: 'originJourneyStation' },
        { model: JourneyStation, as: 'destinationJourneyStation' },
        { model: BookingPassenger, as: 'passengers' },
        { model: BookingSeat, as: 'bookingSeats', include: [{ model: Seat, as: 'seat' }] },
        { model: Payment, as: 'payments' },
      ],
    });
  }
}
module.exports = BookingRepository;
