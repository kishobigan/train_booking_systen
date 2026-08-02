'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Payment, Refund } = require('../../models');
const { Op } = require('sequelize');
class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }
  findByReference(paymentReference, options = {}) {
    return this.findOne({ paymentReference }, options);
  }
  findByProviderReference(providerReference, options = {}) {
    return this.findOne({ providerReference }, options);
  }
  findByBooking(bookingId, options = {}) {
    return this.findAll(
      { bookingId },
      { ...options, order: options.order || [['created_at', 'DESC']] }
    );
  }
  findByBookingId(bookingId, options = {}) {
    return this.findByBooking(bookingId, options);
  }
  findWithRefunds(id, options = {}) {
    return this.model.findByPk(id, { ...options, include: [{ model: Refund, as: 'refunds' }] });
  }
  findForUpdate(id, transaction) {
    return this.findById(id, { transaction, lock: transaction.LOCK?.UPDATE ?? true });
  }
  findByIdForUpdate(id, transaction) {
    return this.findForUpdate(id, transaction);
  }
  findByProviderReferenceForUpdate(providerReference, transaction) {
    return this.findOne(
      { providerReference },
      { transaction, lock: transaction.LOCK?.UPDATE ?? true }
    );
  }
  findSuccessfulByBooking(bookingId, options = {}) {
    return this.findOne({ bookingId, status: 'PAID' }, options);
  }
  findSuccessfulByBookingId(bookingId, options = {}) {
    return this.findSuccessfulByBooking(bookingId, options);
  }
  findActiveAttemptByBookingId(bookingId, options = {}) {
    return this.findOne(
      {
        bookingId,
        status: { [Op.in]: ['PENDING', 'AWAITING_PAYMENT', 'AWAITING_VERIFICATION', 'PROCESSING'] },
      },
      options
    );
  }
  update(payment, values, options = {}) {
    return payment.update(values, options);
  }
  updateStatus(payment, status, options = {}) {
    return payment.update({ status }, options);
  }
  markPaid(payment, values = {}, options = {}) {
    return payment.update(
      { status: 'PAID', paidAt: new Date(), failureCode: null, failureMessage: null, ...values },
      options
    );
  }
  markFailed(payment, values = {}, options = {}) {
    return payment.update({ status: 'FAILED', failedAt: new Date(), ...values }, options);
  }
  markRejected(payment, values = {}, options = {}) {
    return payment.update({ status: 'REJECTED', ...values }, options);
  }
  findStalePendingPayments(before, options = {}) {
    return this.findAll(
      {
        status: { [Op.in]: ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING'] },
        createdAt: { [Op.lt]: before },
      },
      options
    );
  }
  findUnreconciledPayments(options = {}) {
    return this.findAll(
      {
        providerName: 'STRIPE',
        status: {
          [Op.in]: ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING', 'PAID', 'REFUND_PENDING'],
        },
      },
      options
    );
  }
  findReconciliationCandidates({ limit, minAgeMinutes, maxAgeDays }) {
    return this.model.findAll({
      where: {
        providerName: { [Op.in]: ['STRIPE', 'MANUAL_BANK_TRANSFER'] },
        status: {
          [Op.in]: [
            'PENDING',
            'AWAITING_PAYMENT',
            'AWAITING_VERIFICATION',
            'PROCESSING',
            'PAID',
            'REFUND_PENDING',
          ],
        },
        updatedAt: {
          [Op.lte]: this.model.sequelize.literal(
            `NOW() - INTERVAL '${Number(minAgeMinutes)} minutes'`
          ),
          [Op.gte]: this.model.sequelize.literal(`NOW() - INTERVAL '${Number(maxAgeDays)} days'`),
        },
      },
      order: [['updatedAt', 'ASC']],
      limit,
    });
  }
}
module.exports = PaymentRepository;
