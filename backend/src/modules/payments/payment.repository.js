'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Payment, Refund } = require('../../models');
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
  findWithRefunds(id, options = {}) {
    return this.model.findByPk(id, { ...options, include: [{ model: Refund, as: 'refunds' }] });
  }
  findForUpdate(id, transaction) {
    return this.findById(id, { transaction, lock: transaction.LOCK.UPDATE });
  }
}
module.exports = PaymentRepository;
