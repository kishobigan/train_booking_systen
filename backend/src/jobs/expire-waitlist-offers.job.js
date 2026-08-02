'use strict';

class ExpireWaitlistOffersJob {
  constructor({ waitlistService, waitlistRepository, transactionManager, logger = console }) {
    Object.assign(this, { waitlistService, waitlistRepository, transactionManager, logger });
  }
  async run({ limit = 50 } = {}) {
    const ids = await this.transactionManager.execute(async (transaction) => {
      const entries = await this.waitlistRepository.findExpiredOffersForUpdate(limit, transaction);
      return entries.map((entry) => entry.id);
    });
    const results = [];
    for (const waitlistEntryId of ids) {
      try {
        results.push(
          await this.waitlistService.expireOffer({
            waitlistEntryId,
            actor: { role: 'SYSTEM' },
            reason: 'Offer deadline elapsed.',
          })
        );
      } catch (error) {
        this.logger.error?.(
          { waitlistEntryId, code: error.code, err: error },
          'Failed to expire waitlist offer'
        );
      }
    }
    return { selected: ids.length, processed: results.length, results };
  }
}

module.exports = ExpireWaitlistOffersJob;
