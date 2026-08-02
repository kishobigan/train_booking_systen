'use strict';
class ProcessNotificationsJob {
  constructor({
    notificationService,
    notificationRepository,
    transactionManager,
    config,
    logger = console,
  }) {
    Object.assign(this, {
      notificationService,
      notificationRepository,
      transactionManager,
      config,
      logger,
    });
  }
  async run({ batchSize = this.config.batchSize, statuses } = {}) {
    const ids = await this.transactionManager.execute(async (transaction) =>
      (
        await this.notificationRepository.findDueNotifications(batchSize, transaction, statuses)
      ).map((item) => item.id)
    );
    const results = [];
    for (const notificationId of ids) {
      try {
        results.push(await this.notificationService.sendNotification({ notificationId }));
      } catch (error) {
        this.logger.error?.(
          { notificationId, code: error.code, err: error },
          'Notification processing failed'
        );
      }
    }
    return { selected: ids.length, processed: results.filter(Boolean).length, results };
  }
}
module.exports = ProcessNotificationsJob;
