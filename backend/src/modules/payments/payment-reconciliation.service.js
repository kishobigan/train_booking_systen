'use strict';
const ReconciliationError = require('../../common/errors/ReconciliationError');
const { toMinorUnits } = require('../../common/utils/money');
class PaymentReconciliationService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
  }
  reconcilePayment(input) {
    return input.payment.providerName === 'STRIPE'
      ? this.reconcileStripePayment(input)
      : this.reconcileBankSlipPayment(input);
  }
  async reconcileStripePayment({ payment }) {
    const intent = await this.stripePaymentService.retrievePaymentIntent(payment.providerReference);
    const amountMismatch = toMinorUnits(payment.amount, payment.currency) !== intent.amount;
    const currencyMismatch = payment.currency.toLowerCase() !== intent.currency.toLowerCase();
    if (amountMismatch || currencyMismatch)
      return this.applyReconciliationResult({
        payment,
        providerStatus: intent.status,
        result: 'MANUAL_REVIEW',
        differenceType: amountMismatch ? 'AMOUNT_MISMATCH' : 'CURRENCY_MISMATCH',
      });
    if (intent.status === 'succeeded' && payment.status !== 'PAID')
      return this.transactionManager.executeSerializable(async (transaction) => {
        const locked = await this.paymentRepository.findByIdForUpdate(payment.id, transaction);
        await this.paymentService.markPaid(
          locked,
          { providerResponse: { id: intent.id, status: intent.status } },
          { transaction }
        );
        const completion = await this.paymentService.completePaidBooking({
          payment: locked,
          actor: { type: 'SYSTEM', source: 'RECONCILIATION' },
          transaction,
        });
        return this.applyReconciliationResult({
          payment: locked,
          providerStatus: intent.status,
          result: completion.manualResolutionRequired ? 'MANUAL_REVIEW' : 'CORRECTED',
          differenceType: completion.manualResolutionRequired ? 'LATE_PAYMENT' : 'STATUS_MISMATCH',
          transaction,
        });
      });
    if (
      ['canceled', 'requires_payment_method'].includes(intent.status) &&
      ['PENDING', 'PROCESSING', 'AWAITING_PAYMENT'].includes(payment.status)
    ) {
      await this.paymentRepository.markFailed(payment, {
        failureCode: 'RECONCILED_PROVIDER_FAILURE',
      });
      return this.applyReconciliationResult({
        payment,
        providerStatus: intent.status,
        result: 'CORRECTED',
        differenceType: 'STATUS_MISMATCH',
      });
    }
    return this.applyReconciliationResult({
      payment,
      providerStatus: intent.status,
      result: 'MATCHED',
    });
  }
  async reconcileBankSlipPayment({ payment }) {
    const slip = await this.bankSlipRepository.findLatest(payment.id);
    if (slip?.status === 'APPROVED' && payment.status !== 'PAID')
      return this.applyReconciliationResult({
        payment,
        providerStatus: 'APPROVED',
        result: 'MANUAL_REVIEW',
        differenceType: 'APPROVED_SLIP_PAYMENT_MISMATCH',
      });
    if (slip?.status === 'REJECTED' && payment.status === 'AWAITING_VERIFICATION') {
      await payment.update({ status: 'REJECTED' });
      return this.applyReconciliationResult({
        payment,
        providerStatus: 'REJECTED',
        result: 'CORRECTED',
        differenceType: 'STATUS_MISMATCH',
      });
    }
    return this.applyReconciliationResult({
      payment,
      providerStatus: slip?.status,
      result: 'MATCHED',
    });
  }
  reconcileRefund(refund) {
    return refund;
  }
  findUnreconciledPayments(options = {}) {
    return this.paymentRepository.findUnreconciledPayments(options);
  }
  findStalePendingPayments(before, options = {}) {
    return this.paymentRepository.findStalePendingPayments(before, options);
  }
  findPaidUnconfirmedBookings(options = {}) {
    return this.paymentRepository.model.sequelize.query(
      "SELECT p.id FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE p.status='PAID' AND b.status<>'CONFIRMED'",
      options
    );
  }
  findConfirmedUnpaidBookings(options = {}) {
    return this.paymentRepository.model.sequelize.query(
      "SELECT b.id FROM bookings b WHERE b.status='CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id=b.id AND p.status IN ('PAID','PARTIALLY_REFUNDED','REFUNDED'))",
      options
    );
  }
  findProviderAmountMismatches() {
    throw new ReconciliationError('Provider lookup is required per payment');
  }
  applyReconciliationResult({ payment, providerStatus, result, differenceType, transaction }) {
    return this.reconciliationRepository.create(
      {
        paymentId: payment.id,
        providerName: payment.providerName,
        internalStatusBefore: payment.previous?.('status') || payment.status,
        providerStatus,
        internalStatusAfter: payment.status,
        result,
        differenceType,
        details: differenceType ? { requiresReview: result === 'MANUAL_REVIEW' } : null,
      },
      { transaction }
    );
  }
}
module.exports = PaymentReconciliationService;
