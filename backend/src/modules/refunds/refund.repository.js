'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Refund, Payment, Booking } = require('../../models');
const { Op } = require('sequelize');
class RefundRepository extends BaseRepository {
  constructor() {
    super(Refund);
  }
  findByReference(refundReference, options = {}) {
    return this.findOne({ refundReference }, options);
  }
  findByProviderReference(providerRefundReference, options = {}) {
    return this.findOne({ providerRefundReference }, options);
  }
  findByPayment(paymentId, options = {}) {
    return this.findAll({ paymentId }, options);
  }
  findByPaymentId(paymentId, options = {}) {
    return this.findByPayment(paymentId, options);
  }
  findByIdForUpdate(id, transaction) {
    return this.findById(id, { transaction, lock: transaction.LOCK?.UPDATE ?? true });
  }
  findByBooking(bookingId, options = {}) {
    return this.findAll({ bookingId }, options);
  }
  findDetails(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [
        { model: Payment, as: 'payment' },
        { model: Booking, as: 'booking' },
      ],
    });
  }
  findSuccessfulByBooking(bookingId, options = {}) {
    return this.findOne({ bookingId, status: 'REFUNDED' }, options);
  }
  findSuccessfulByPaymentId(paymentId, options = {}) {
    return this.findAll({ paymentId, status: 'REFUNDED' }, options);
  }
  async sumSuccessfulRefunds(paymentId, options = {}) {
    const value = await this.model.sum('amount', {
      ...options,
      where: { paymentId, status: 'REFUNDED' },
    });
    return value || '0.00';
  }
  findPendingRefunds(options = {}) {
    return this.findAll(
      { status: { [Op.in]: ['PENDING', 'PROCESSING', 'PENDING_MANUAL_PROCESSING'] } },
      options
    );
  }
  updateStatus(refund, status, values = {}, options = {}) {
    return refund.update({ status, ...values }, options);
  }
  markCompleted(refund, values = {}, options = {}) {
    return refund.update({ status: 'REFUNDED', processedAt: new Date(), ...values }, options);
  }
  markFailed(refund, values = {}, options = {}) {
    return refund.update({ status: 'FAILED', ...values }, options);
  }
}
module.exports = RefundRepository;
