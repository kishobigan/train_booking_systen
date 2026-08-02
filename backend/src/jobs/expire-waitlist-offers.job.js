'use strict';
const processRecords = require('./record-batch');
class ExpireWaitlistOffersJob {
  constructor({ waitlistRepository, waitlistService, config, logger = console }) {
    Object.assign(this, { waitlistRepository, waitlistService, config, logger });
  }
  async execute() {
    const totals = { found: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 };
    while (totals.processed < this.config.maxPerRun) {
      const limit = Math.min(this.config.batchSize, this.config.maxPerRun - totals.processed);
      const ids = await this.waitlistRepository.findExpiredOfferIds({ limit });
      if (!ids.length) break;
      const result = await processRecords(
        ids,
        async (waitlistEntryId) => {
          const entry = await this.waitlistService.expireOffer({
            waitlistEntryId,
            actor: { type: 'SYSTEM', role: 'SYSTEM', id: null },
            reason: 'WAITLIST_OFFER_TIMEOUT',
          });
          return { skipped: entry?.status === 'OFFERED' };
        },
        {
          maxFailures: this.config.maxRecordFailures,
          logger: this.logger,
          recordLabel: 'Waitlist offer',
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
module.exports = ExpireWaitlistOffersJob;
