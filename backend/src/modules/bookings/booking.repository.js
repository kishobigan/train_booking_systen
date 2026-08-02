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
  findByIdForUpdate(bookingId, transaction) {
    return this.findById(bookingId, { transaction, lock: transaction.LOCK.UPDATE });
  }
  findByReferenceForUpdate(bookingReference, transaction) {
    return this.findOne({ bookingReference }, { transaction, lock: transaction.LOCK.UPDATE });
  }
  findByUserId(userId, options = {}) {
    return this.findByUser(userId, options);
  }
  findByJourneyId(journeyId, options = {}) {
    return this.findByJourney(journeyId, options);
  }
  update(booking, values, options = {}) {
    return booking.update(values, options);
  }
  updateStatus(booking, status, options = {}) {
    return booking.update({ status }, options);
  }
  findExpiredHeldBookings(referenceDate = new Date(), options = {}) {
    return this.findExpiredHolds(referenceDate, options);
  }
  countByUser(userId, options = {}) {
    return this.count({ userId }, options);
  }
  existsByIdempotencyKey() {
    return Promise.resolve(false);
  }
  findByIdempotencyKey() {
    return Promise.resolve(null);
  }
  findForExpiryBatch(limit, transaction) {
    return this.model.findAll({
      where: { status: 'HELD', holdExpiresAt: { [Op.lte]: this.model.sequelize.fn('NOW') } },
      attributes: ['id', 'holdExpiresAt'],
      limit,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
  }
  async findExpiredHeldBookingIds({ limit }) {
    const rows = await this.model.findAll({
      where: { status: 'HELD', holdExpiresAt: { [Op.lte]: this.model.sequelize.fn('NOW') } },
      attributes: ['id'],
      order: [['holdExpiresAt', 'ASC']],
      limit,
      raw: true,
    });
    return rows.map((row) => row.id);
  }
  async databaseNow(transaction) {
    const [rows] = await this.model.sequelize.query('SELECT NOW() AS "now"', { transaction });
    return new Date(rows[0].now);
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
