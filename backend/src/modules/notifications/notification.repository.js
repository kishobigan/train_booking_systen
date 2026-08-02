'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Notification } = require('../../models');
class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }
  findByBooking(bookingId, options = {}) {
    return this.findAll({ bookingId }, options);
  }
  findByUser(userId, options = {}) {
    return this.findAll({ userId }, options);
  }
  findPending(referenceDate = new Date(), options = {}) {
    return this.findAll(
      {
        status: 'PENDING',
        [Op.or]: [{ scheduledAt: null }, { scheduledAt: { [Op.lte]: referenceDate } }],
      },
      { ...options, order: options.order || [['created_at', 'ASC']] }
    );
  }
  findPendingForUpdate(referenceDate, transaction, limit = 100) {
    return this.model.findAll({
      where: {
        status: 'PENDING',
        [Op.or]: [{ scheduledAt: null }, { scheduledAt: { [Op.lte]: referenceDate } }],
      },
      order: [['created_at', 'ASC']],
      limit,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
  }
}
module.exports = NotificationRepository;
