'use strict';
const crypto = require('node:crypto');
const os = require('node:os');
const sequelize = require('../database/sequelize');
const repositories = require('../container/repositories');
const services = require('../container/services');
const logger = require('../config/logger');
const config = require('../config/jobs');
const JobLockService = require('./job-lock.service');
const JobRunner = require('./job-runner');
const JobRegistry = require('./job-registry');
const ExpireBookingHoldsJob = require('./expire-booking-holds.job');
const ExpireWaitlistOffersJob = require('./expire-waitlist-offers.job');
const RetryNotificationsJob = require('./retry-notifications.job');
const ReconcilePaymentsJob = require('./reconcile-payments.job');
const RecoverStaleJobsJob = require('./recover-stale-jobs.job');
const N = require('../common/constants/job-name.constants');
function createJobContainer() {
  const workerId = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
  const jobLockService = new JobLockService({ sequelize, logger });
  const runner = new JobRunner({
    jobLockService,
    jobExecutionRepository: repositories.jobExecutionRepository,
    logger,
    workerId,
  });
  const common = { maxRecordFailures: config.maxRecordFailures };
  const booking = new ExpireBookingHoldsJob({
    bookingRepository: repositories.bookingRepository,
    bookingService: services.bookingService,
    config: { ...config.expireBookingHolds, ...common },
    logger,
  });
  const waitlist = new ExpireWaitlistOffersJob({
    waitlistRepository: repositories.waitlistRepository,
    waitlistService: services.waitlistService,
    config: { ...config.expireWaitlistOffers, ...common },
    logger,
  });
  const notifications = new RetryNotificationsJob({
    notificationRepository: repositories.notificationRepository,
    notificationService: services.notificationService,
    transactionManager: services.transactionManager,
    config: {
      ...config.retryNotifications,
      ...common,
      staleProcessingMinutes: config.staleProcessingMinutes,
    },
    logger,
    workerId,
  });
  const recovery = new RecoverStaleJobsJob({
    notificationRepository: repositories.notificationRepository,
    transactionManager: services.transactionManager,
    config: { ...config, workerId },
  });
  const payments = new ReconcilePaymentsJob({
    paymentRepository: repositories.paymentRepository,
    paymentReconciliationService: services.paymentReconciliationService,
    config: { ...config.reconcilePayments, ...common },
    logger,
  });
  const definitions = [
    {
      name: N.EXPIRE_BOOKING_HOLDS,
      ...config.expireBookingHolds,
      handler: () => booking.execute(),
    },
    {
      name: N.EXPIRE_WAITLIST_OFFERS,
      ...config.expireWaitlistOffers,
      handler: () => waitlist.execute(),
    },
    {
      name: N.RETRY_NOTIFICATIONS,
      ...config.retryNotifications,
      handler: async () => {
        await runner.run({ jobName: N.RECOVER_STALE_JOBS, handler: () => recovery.execute() });
        return notifications.execute();
      },
    },
    { name: N.RECONCILE_PAYMENTS, ...config.reconcilePayments, handler: () => payments.execute() },
  ];
  const registry = new JobRegistry({ runner, definitions, timezone: config.timezone, logger });
  return {
    workerId,
    config,
    runner,
    registry,
    jobLockService,
    jobExecutionRepository: repositories.jobExecutionRepository,
  };
}
module.exports = createJobContainer;
