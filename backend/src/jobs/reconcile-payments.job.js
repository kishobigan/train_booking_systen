'use strict';
const processRecords = require('./record-batch');
class ReconcilePaymentsJob {
  constructor({ paymentRepository, paymentReconciliationService, config, logger = console }) {
    Object.assign(this, { paymentRepository, paymentReconciliationService, config, logger });
  }
  async execute() {
    const payments = await this.paymentRepository.findReconciliationCandidates({
      limit: Math.min(this.config.batchSize, this.config.maxPerRun),
      minAgeMinutes: this.config.minAgeMinutes,
      maxAgeDays: this.config.maxAgeDays,
    });
    const byId = new Map(payments.map((payment) => [payment.id, payment]));
    return processRecords(
      [...byId.keys()],
      (id) =>
        this.paymentReconciliationService.reconcilePayment({
          payment: byId.get(id),
          actor: { type: 'SYSTEM', id: null },
        }),
      {
        maxFailures: this.config.maxRecordFailures,
        concurrency: this.config.concurrency,
        logger: this.logger,
        recordLabel: 'Payment reconciliation',
      }
    );
  }
}
module.exports = ReconcilePaymentsJob;
