'use strict';
const services = require('../container/services');
const repositories = require('../container/repositories');
const logger = require('../config/logger');

async function expireBookingHolds({
  bookingService = services.bookingService,
  bookingRepository = repositories.bookingRepository,
  transactionManager = services.transactionManager,
  batchSize = 100,
} = {}) {
  const bookings = await transactionManager.execute((transaction) =>
    bookingRepository.findForExpiryBatch(batchSize, transaction)
  );
  const results = [];
  for (const booking of bookings) {
    try {
      await bookingService.expireBooking({
        bookingId: booking.id,
        actor: { type: 'SYSTEM', source: 'expire-booking-holds-job' },
        reason: 'Booking hold expired before payment.',
        metadata: { holdExpiresAt: booking.holdExpiresAt },
      });
      results.push({ bookingId: booking.id, expired: true });
    } catch (error) {
      logger.error({ err: error, bookingId: booking.id }, 'Failed to expire booking hold');
      results.push({ bookingId: booking.id, expired: false, error });
    }
  }
  return results;
}
module.exports = expireBookingHolds;
