'use strict';
const config = require('../config/payment');
class ExpirePendingPaymentsJob {
  constructor({ paymentRepository, paymentService }) {
    Object.assign(this, { paymentRepository, paymentService });
  }
  async run() {
    const before = new Date(Date.now() - config.pendingExpiryMinutes * 60000);
    const payments = await this.paymentRepository.findStalePendingPayments(before);
    for (const payment of payments) await this.paymentService.expirePayment(payment);
    return payments.length;
  }
}
module.exports = ExpirePendingPaymentsJob;
