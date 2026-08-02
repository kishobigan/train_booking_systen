'use strict';
const NotFoundError = require('../../common/errors/NotFoundError');
const { createSegment } = require('../../common/utils/segment-overlap');
class BookingSeatService {
  constructor({ bookingSeatRepository }) {
    this.repository = bookingSeatRepository;
  }
  /** Create one immutable booking-seat snapshot. */
  createBookingSeat(input) {
    this.validateSegment(input.originSequence, input.destinationSequence);
    return this.repository.create(this.createSnapshotData(input), {
      transaction: input.transaction,
    });
  }
  /** Bulk-create booking-seat snapshots atomically. */
  bulkCreateBookingSeats({ seats, transaction }) {
    seats.forEach((seat) => this.validateSegment(seat.originSequence, seat.destinationSequence));
    return this.repository.bulkCreate(
      seats.map((seat) => this.createSnapshotData(seat)),
      { transaction, returning: true }
    );
  }
  /** Get one booking-seat row. */
  async getBookingSeatById(id, options = {}) {
    const item = await this.repository.findById(id, options);
    if (!item) throw new NotFoundError('Booking seat not found');
    return item;
  }
  /** List booking-seat history rows. */
  getBookingSeats(bookingId, options = {}) {
    return this.repository.findByBooking(bookingId, options);
  }
  /** Update one booking-seat status. */
  async updateStatus(id, status, options = {}) {
    const item = await this.getBookingSeatById(id, options);
    return item.update({ status }, options);
  }
  /** Update all booking-seat statuses. */
  updateStatusesByBooking(bookingId, status, options = {}) {
    return this.repository.updateStatusesByBooking(bookingId, status, options);
  }
  /** Replace snapshot identifiers after allocation validation. */
  async replaceSeat(id, snapshot, options = {}) {
    const item = await this.getBookingSeatById(id, options);
    return item.update(this.createSnapshotData({ ...item.get?.(), ...item, ...snapshot }), options);
  }
  /** Remove a booking-seat row while preserving other booking history. */
  async removeBookingSeat(id, options = {}) {
    const item = await this.getBookingSeatById(id, options);
    await item.destroy(options);
    return true;
  }
  /** Validate a half-open booking segment. */
  validateSegment(originSequence, destinationSequence) {
    return createSegment(Number(originSequence), Number(destinationSequence));
  }
  /** Build fields allowed in a booking-seat snapshot; occupiedSegment is DB-generated. */
  createSnapshotData(input) {
    return Object.fromEntries(
      [
        'bookingId',
        'bookingPassengerId',
        'journeyId',
        'journeySeatId',
        'seatId',
        'originSequence',
        'destinationSequence',
        'status',
        'holdExpiresAt',
        'seatNumberSnapshot',
        'coachNumberSnapshot',
        'coachClassSnapshot',
        'fareAmount',
      ]
        .filter((field) => input[field] !== undefined)
        .map((field) => [field, input[field]])
    );
  }
}
module.exports = BookingSeatService;
