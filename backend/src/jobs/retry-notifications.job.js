'use strict';
const STATUS = require('../common/constants/notification-status.constants');
class RetryNotificationsJob {
  constructor({ processNotificationsJob, notificationRepository, transactionManager, config }) {
    Object.assign(this, {
      processNotificationsJob,
      notificationRepository,
      transactionManager,
      config,
    });
  }
  async run() {
    await this.recoverStaleProcessingNotifications();
    return this.processNotificationsJob.run({ statuses: [STATUS.RETRYING] });
  }
  recoverStaleProcessingNotifications() {
    return this.transactionManager.execute(async (transaction) => {
      const cutoff = new Date(Date.now() - this.config.processingTimeoutMinutes * 60_000);
      const stale = await this.notificationRepository.findStaleProcessingNotifications(
        cutoff,
        this.config.batchSize,
        transaction
      );
      for (const notification of stale)
        await this.notificationRepository.markRetrying(
          notification,
          { code: 'STALE_PROCESSING_RECOVERED', message: 'Worker processing lease expired.' },
          new Date(),
          { transaction }
        );
      return stale.length;
    });
  }
}
module.exports = RetryNotificationsJob;
