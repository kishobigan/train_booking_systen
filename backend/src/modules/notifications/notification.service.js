'use strict';
const NotificationRepository = require('./notification.repository');
class NotificationService {
  constructor(repository = new NotificationRepository()) {
    this.repository = repository;
  }
  /** Queue a booking-status email after the status transaction commits. */
  bookingStatusChanged({ booking, previousStatus }, options = {}) {
    if (!booking.contactEmail) return null;
    return this.repository.create(
      {
        userId: booking.userId,
        bookingId: booking.id,
        channel: 'EMAIL',
        destination: booking.contactEmail,
        templateCode: 'BOOKING_STATUS_CHANGED',
        subject: `Booking ${booking.bookingReference} is ${booking.status}`,
        content: `Your booking status changed from ${previousStatus} to ${booking.status}.`,
        status: 'PENDING',
        scheduledAt: new Date(),
      },
      options
    );
  }
}
module.exports = NotificationService;
