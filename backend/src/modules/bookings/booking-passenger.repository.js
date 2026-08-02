'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { BookingPassenger, Seat } = require('../../models');
class BookingPassengerRepository extends BaseRepository {
  constructor() {
    super(BookingPassenger);
  }
  findByBooking(bookingId, options = {}) {
    return this.findAll(
      { bookingId },
      {
        ...options,
        include: options.include || [{ model: Seat, as: 'assignedSeat' }],
        order: options.order || [['created_at', 'ASC']],
      }
    );
  }
  deleteByBooking(bookingId, options = {}) {
    return this.model.destroy({ ...options, where: { bookingId } });
  }
  findByBookingAndId(bookingId, id, options = {}) {
    return this.findOne({ bookingId, id }, options);
  }
  findByAssignedSeat(bookingId, assignedSeatId, options = {}) {
    return this.findOne({ bookingId, assignedSeatId }, options);
  }
}
module.exports = BookingPassengerRepository;
