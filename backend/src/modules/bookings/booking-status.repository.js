'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { BookingStatusHistory, Journey } = require('../../models');
class BookingStatusRepository extends BaseRepository {
  constructor() {
    super(BookingStatusHistory);
  }
  findBookingForUpdate(bookingRepository, bookingId, transaction) {
    return bookingRepository.findById(bookingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      include: [{ model: Journey, as: 'journey' }],
    });
  }
  updateBookingStatus(booking, values, options = {}) {
    return booking.update(values, options);
  }
  createStatusHistory(values, options = {}) {
    return this.create(values, options);
  }
  getStatusHistory(bookingId, options = {}) {
    return this.findAll(
      { bookingId },
      { ...options, order: options.order || [['createdAt', 'ASC']] }
    );
  }
  updateBookingSeatStatuses(bookingSeatRepository, bookingId, status, options = {}) {
    return bookingSeatRepository.model.update({ status }, { ...options, where: { bookingId } });
  }
  findLatestStatusHistory(bookingId, options = {}) {
    return this.findOne({ bookingId }, { ...options, order: [['createdAt', 'DESC']] });
  }
}
module.exports = BookingStatusRepository;
