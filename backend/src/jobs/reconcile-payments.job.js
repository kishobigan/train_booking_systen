'use strict';
class ReconcilePaymentsJob {
  constructor(service, { batchSize = 50 } = {}) {
    this.service = service;
    this.batchSize = batchSize;
  }
  async run() {
    const payments = await this.service.findUnreconciledPayments({
      limit: this.batchSize,
      order: [['updated_at', 'ASC']],
    });
    const results = [];
    for (const payment of payments) {
      try {
        results.push(await this.service.reconcilePayment({ payment }));
      } catch (error) {
        results.push({ paymentId: payment.id, error: error.code || error.name });
      }
    }
    return results;
  }
}
module.exports = ReconcilePaymentsJob;
