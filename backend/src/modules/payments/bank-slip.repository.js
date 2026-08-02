'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { BankPaymentSlip, Payment, Booking } = require('../../models');
class BankSlipRepository extends BaseRepository {
  constructor() {
    super(BankPaymentSlip);
  }
  findLatest(paymentId, options = {}) {
    return this.model.findOne({
      ...options,
      where: { paymentId },
      order: [['created_at', 'DESC']],
    });
  }
  findByHash(fileHash, options = {}) {
    return this.findOne({ fileHash }, options);
  }
  supersede(paymentId, options = {}) {
    return this.model.update(
      { status: 'SUPERSEDED' },
      { ...options, where: { paymentId, status: ['UPLOADED', 'UNDER_REVIEW', 'REJECTED'] } }
    );
  }
  findPending(options = {}) {
    return this.model.findAll({
      ...options,
      where: { status: ['UPLOADED', 'UNDER_REVIEW'] },
      include: [{ model: Payment, as: 'payment', include: [{ model: Booking, as: 'booking' }] }],
      order: [['created_at', 'ASC']],
    });
  }
}
module.exports = BankSlipRepository;
