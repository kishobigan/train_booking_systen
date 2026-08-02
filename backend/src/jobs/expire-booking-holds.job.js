'use strict';
const processRecords = require('./record-batch');
class ExpireBookingHoldsJob {
  constructor({ bookingRepository, bookingService, config, logger = console }) {
    Object.assign(this, { bookingRepository, bookingService, config, logger });
  }
  async execute() {
    const totals = { found: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 };
    while (totals.processed < this.config.maxPerRun) {
      const limit = Math.min(this.config.batchSize, this.config.maxPerRun - totals.processed);
      const ids = await this.bookingRepository.findExpiredHeldBookingIds({ limit });
      if (!ids.length) break;
      const result = await processRecords(
        ids,
        async (bookingId) => {
          const booking = await this.bookingService.expireBooking({
            bookingId,
            actor: { type: 'SYSTEM', id: null, source: 'BACKGROUND_JOB' },
            reason: 'BOOKING_HOLD_TIMEOUT',
          });
          return { skipped: booking?.status && booking.status !== 'EXPIRED' };
        },
        {
          maxFailures: this.config.maxRecordFailures,
          logger: this.logger,
          recordLabel: 'Booking hold',
        }
      );
      merge(totals, result);
      if (ids.length < limit) break;
    }
    return totals;
  }
}
const merge = (target, value) => {
  for (const key of Object.keys(target)) target[key] += value[key] || 0;
};
module.exports = ExpireBookingHoldsJob;
