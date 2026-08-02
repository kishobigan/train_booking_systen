'use strict';
class CleanupNotificationsJob {
  constructor({ notificationRepository, config }) {
    Object.assign(this, { notificationRepository, config });
  }
  run() {
    return this.notificationRepository.deleteOlderThan(
      new Date(Date.now() - this.config.retentionDays * 86_400_000)
    );
  }
}
module.exports = CleanupNotificationsJob;
