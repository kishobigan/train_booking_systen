'use strict';
class RecoverStaleJobsJob {
  constructor({ notificationRepository, transactionManager, config }) {
    Object.assign(this, { notificationRepository, transactionManager, config });
  }
  async execute() {
    const cutoff = new Date(Date.now() - this.config.staleProcessingMinutes * 60000);
    const ids = await this.transactionManager.execute((transaction) =>
      this.notificationRepository.recoverStaleProcessing(
        cutoff,
        this.config.retryNotifications.batchSize,
        transaction
      )
    );
    return {
      found: ids.length,
      processed: ids.length,
      succeeded: ids.length,
      failed: 0,
      skipped: 0,
    };
  }
}
module.exports = RecoverStaleJobsJob;
