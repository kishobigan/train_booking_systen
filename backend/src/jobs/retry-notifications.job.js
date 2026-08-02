'use strict';
const processRecords = require('./record-batch');
const STATUS = require('../common/constants/notification-status.constants');
class RetryNotificationsJob {
  constructor({
    notificationRepository,
    notificationService,
    transactionManager,
    config,
    logger = console,
    workerId,
  }) {
    Object.assign(this, {
      notificationRepository,
      notificationService,
      transactionManager,
      config,
      logger,
      workerId,
    });
  }
  async execute() {
    const ids = await this.transactionManager.execute((transaction) =>
      this.notificationRepository.claimDueNotifications(
        {
          limit: this.config.batchSize,
          workerId: this.workerId,
          statuses: [STATUS.PENDING, STATUS.RETRYING],
        },
        transaction
      )
    );
    return processRecords(
      ids,
      (id) =>
        this.notificationService.sendNotification({ notificationId: id, workerId: this.workerId }),
      {
        maxFailures: this.config.maxRecordFailures,
        concurrency: this.config.concurrency,
        logger: this.logger,
        recordLabel: 'Notification',
      }
    );
  }
}
module.exports = RetryNotificationsJob;
