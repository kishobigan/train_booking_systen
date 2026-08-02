'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Notification } = require('../../models');
const STATUS = require('../../common/constants/notification-status.constants');
class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }
  findByIdForUpdate(id, transaction) {
    return this.findById(id, { transaction, lock: transaction.LOCK.UPDATE });
  }
  findByUserId(userId, options = {}) {
    return this.findAll({ userId }, { ...options, order: [['createdAt', 'DESC']] });
  }
  findByBookingId(bookingId, options = {}) {
    return this.findAll({ bookingId }, { ...options, order: [['createdAt', 'DESC']] });
  }
  findByBooking(bookingId, options = {}) {
    return this.findByBookingId(bookingId, options);
  }
  findByUser(userId, options = {}) {
    return this.findByUserId(userId, options);
  }
  findByDeduplicationKey(deduplicationKey, options = {}) {
    return this.findOne({ deduplicationKey }, options);
  }
  findForAdmin(adminUserId, options = {}) {
    const escapedId = this.model.sequelize.escape(adminUserId);
    return this.paginate(
      {
        [Op.or]: [
          {
            journeyId: {
              [Op.in]: this.model.sequelize.literal(
                `(SELECT journey_id FROM admin_journeys WHERE admin_user_id = ${escapedId} AND is_active = TRUE)`
              ),
            },
          },
          {
            bookingId: {
              [Op.in]: this.model.sequelize.literal(
                `(SELECT b.id FROM bookings b JOIN admin_journeys aj ON aj.journey_id = b.journey_id WHERE aj.admin_user_id = ${escapedId} AND aj.is_active = TRUE)`
              ),
            },
          },
        ],
      },
      options
    );
  }
  existsByDeduplicationKey(deduplicationKey, options = {}) {
    return this.exists({ deduplicationKey }, options);
  }
  findDueNotifications(limit, transaction, statuses = [STATUS.PENDING, STATUS.RETRYING]) {
    const due = this.model.sequelize.literal(
      'COALESCE("next_retry_at", "scheduled_at", "created_at") <= NOW()'
    );
    return this.model.findAll({
      where: {
        status: { [Op.in]: statuses },
        [Op.and]: [due, this.model.sequelize.literal('"attempt_count" < "max_attempts"')],
      },
      order: [['createdAt', 'ASC']],
      limit,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
  }
  claimForProcessing(notification, options = {}) {
    return notification.update(
      {
        status: STATUS.PROCESSING,
        lastAttemptAt: new Date(),
        attemptCount: Number(notification.attemptCount || 0) + 1,
        processingWorkerId: options.workerId || null,
      },
      options
    );
  }
  async claimDueNotifications(
    { limit, workerId, statuses = [STATUS.PENDING, STATUS.RETRYING] },
    transaction
  ) {
    const records = await this.findDueNotifications(limit, transaction, statuses);
    for (const record of records) await this.claimForProcessing(record, { transaction, workerId });
    return records.map((record) => record.id);
  }
  markProcessing(notification, options = {}) {
    return this.claimForProcessing(notification, options);
  }
  markSent(notification, result, options = {}) {
    return notification.update(
      {
        status: STATUS.SENT,
        providerName: result.providerName,
        providerReference: result.providerReference,
        sentAt: new Date(),
        nextRetryAt: null,
        failureCode: null,
        failureMessage: null,
        processingWorkerId: null,
      },
      options
    );
  }
  markRetrying(notification, failure, nextRetryAt, options = {}) {
    return notification.update(
      {
        status: STATUS.RETRYING,
        failureCode: failure.code,
        failureMessage: failure.message,
        nextRetryAt,
        processingWorkerId: null,
      },
      options
    );
  }
  recoverStaleProcessing(cutoff, limit, transaction) {
    return this.findStaleProcessingNotifications(cutoff, limit, transaction).then(
      async (records) => {
        for (const record of records)
          await this.markRetrying(
            record,
            { code: 'WORKER_PROCESSING_TIMEOUT', message: 'Worker processing lease expired.' },
            this.model.sequelize.fn('NOW'),
            { transaction }
          );
        return records.map((record) => record.id);
      }
    );
  }
  markFailed(notification, failure, options = {}) {
    return notification.update(
      {
        status: STATUS.FAILED,
        failureCode: failure.code,
        failureMessage: failure.message,
        nextRetryAt: null,
        processingWorkerId: null,
      },
      options
    );
  }
  cancel(notification, options = {}) {
    return notification.update({ status: STATUS.CANCELLED, nextRetryAt: null }, options);
  }
  incrementAttempt(notification, options = {}) {
    return notification.increment('attemptCount', options);
  }
  findStaleProcessingNotifications(cutoff, limit, transaction) {
    return this.model.findAll({
      where: { status: STATUS.PROCESSING, lastAttemptAt: { [Op.lte]: cutoff } },
      limit,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
  }
  deleteOlderThan(cutoff, options = {}) {
    return this.model.destroy({
      ...options,
      where: {
        status: { [Op.in]: [STATUS.SENT, STATUS.CANCELLED] },
        createdAt: { [Op.lt]: cutoff },
      },
    });
  }
  async findJourneyDelayRecipients(journeyId, options = {}) {
    const [rows] = await this.model.sequelize.query(
      `
      SELECT DISTINCT b.user_id AS "userId",
        COALESCE(b.contact_email, u.email) AS email,
        COALESCE(b.contact_phone, u.phone_number) AS phone,
        COALESCE(b.contact_name, u.full_name) AS "fullName"
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      WHERE b.journey_id = :journeyId AND b.status = 'CONFIRMED'
    `,
      { replacements: { journeyId }, ...options }
    );
    return rows;
  }
}
module.exports = NotificationRepository;
