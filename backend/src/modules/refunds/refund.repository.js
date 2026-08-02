'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Refund, Payment, Booking } = require('../../models');
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
}
module.exports = RefundRepository;
