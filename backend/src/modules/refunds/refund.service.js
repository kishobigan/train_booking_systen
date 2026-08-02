'use strict';
const AuthorizationError = require('../../common/errors/AuthorizationError');
const NotFoundError = require('../../common/errors/NotFoundError');
const RefundError = require('../../common/errors/RefundError');
const { toDecimal, subtract, formatAmount } = require('../../common/utils/money');
const { generateRefundReference } = require('../../common/utils/payment-reference');
const { toRefundDto } = require('./refund.dto');
const { Op } = require('sequelize');
class RefundService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
  }
  async validateRefundEligibility({ payment, booking, requestedAmount, actor, transaction }) {
    await this.#authorize(actor, booking.journeyId, transaction);
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status))
      throw new RefundError('Only paid payments are refundable');
    const successful = await this.refundRepository.sumSuccessfulRefunds(payment.id, {
      transaction,
    });
    const remaining = subtract(payment.amount, successful);
    const amount =
      requestedAmount === undefined || requestedAmount === null
        ? remaining
        : toDecimal(requestedAmount);
    if (!amount.gt(0) || amount.gt(remaining))
      throw new RefundError('Refund amount exceeds the remaining refundable balance');
    const pending = await this.refundRepository.findPendingRefunds({ transaction });
    if (pending.some((item) => item.paymentId === payment.id))
      throw new RefundError('A refund is already pending for this payment');
    return {
      amount: formatAmount(amount),
      remaining: formatAmount(remaining),
      full: amount.eq(remaining),
    };
  }
  async createRefund(input) {
    const payment = await this.paymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    const booking = await this.bookingRepository.findById(payment.bookingId);
    const eligibility = await this.validateRefundEligibility({
      payment,
      booking,
      requestedAmount: input.requestedAmount,
      actor: input.actor,
    });
    const created = await this.transactionManager.executeSerializable(async (transaction) => {
      const idem = await this.idempotencyService.begin({
        scope: `refund:create:${input.actor.id}`,
        key: input.idempotencyKey,
        request: { paymentId: payment.id, amount: eligibility.amount, reason: input.reason },
        transaction,
      });
      if (idem?.responseBody) return { replayed: true, response: idem.responseBody };
      const lockedPayment = await this.paymentRepository.findByIdForUpdate(payment.id, transaction);
      const lockedEligibility = await this.validateRefundEligibility({
        payment: lockedPayment,
        booking,
        requestedAmount: eligibility.amount,
        actor: input.actor,
        transaction,
      });
      const refund = await this.refundRepository.create(
        {
          paymentId: payment.id,
          bookingId: booking.id,
          refundReference: generateRefundReference(),
          amount: lockedEligibility.amount,
          reason: input.reason,
          status: payment.method === 'BANK_SLIP' ? 'PENDING_MANUAL_PROCESSING' : 'PROCESSING',
        },
        { transaction }
      );
      await lockedPayment.update({ status: 'REFUND_PENDING' }, { transaction });
      await this.auditService.record(
        {
          userId: input.actor.id,
          action: 'REFUND_REQUESTED',
          entityType: 'Refund',
          entityId: refund.id,
          newValues: { amount: refund.amount, method: payment.method },
        },
        { transaction }
      );
      return { refund, payment: lockedPayment, idem };
    });
    if (created.replayed) return created.response;
    if (payment.method === 'BANK_SLIP') {
      const response = toRefundDto(created.refund);
      await this.idempotencyService.complete(created.idem, {
        resourceType: 'Refund',
        resourceId: created.refund.id,
        responseStatus: 201,
        responseBody: response,
      });
      return response;
    }
    try {
      const providerRefund = await this.stripePaymentService.createRefund({
        refund: created.refund,
        payment,
      });
      await created.refund.update({
        providerRefundReference: providerRefund.id,
        providerResponse: { id: providerRefund.id, status: providerRefund.status },
      });
      if (providerRefund.status === 'succeeded') {
        await this.refundRepository.markCompleted(created.refund);
        await this.updatePaymentRefundStatus(payment.id);
      }
      const response = toRefundDto(created.refund);
      await this.idempotencyService.complete(created.idem, {
        resourceType: 'Refund',
        resourceId: created.refund.id,
        responseStatus: 201,
        responseBody: response,
      });
      return response;
    } catch (error) {
      await this.refundRepository.markFailed(created.refund, {
        failureCode: error.code || 'STRIPE_REFUND_FAILED',
        failureMessage: String(error.message).slice(0, 500),
      });
      await created.payment.update({ status: payment.status });
      throw new RefundError('Stripe refund submission failed', undefined, { cause: error });
    }
  }
  async completeManualRefund({ refundId, actor, bankReference, note }) {
    if (!bankReference) throw new RefundError('Bank refund reference is required');
    return this.transactionManager.executeSerializable(async (transaction) => {
      const refund = await this.refundRepository.findByIdForUpdate(refundId, transaction);
      if (!refund) throw new NotFoundError('Refund not found');
      const payment = await this.paymentRepository.findByIdForUpdate(refund.paymentId, transaction);
      const booking = await this.bookingRepository.findById(payment.bookingId, { transaction });
      await this.#authorize(actor, booking.journeyId, transaction);
      if (payment.method !== 'BANK_SLIP' || refund.status !== 'PENDING_MANUAL_PROCESSING')
        throw new RefundError('Refund is not awaiting manual processing');
      await this.refundRepository.markCompleted(
        refund,
        {
          manualRefundReference: bankReference,
          manualRefundNote: note,
          processedByUserId: actor.id,
        },
        { transaction }
      );
      await this.updatePaymentRefundStatus(payment.id, transaction);
      await this.auditService.record(
        {
          userId: actor.id,
          action: 'MANUAL_REFUND_COMPLETED',
          entityType: 'Refund',
          entityId: refund.id,
          newValues: { bankReference },
        },
        { transaction }
      );
      return toRefundDto(refund);
    });
  }
  async updatePaymentRefundStatus(paymentId, transaction) {
    const payment = transaction
      ? await this.paymentRepository.findByIdForUpdate(paymentId, transaction)
      : await this.paymentRepository.findById(paymentId);
    const total = await this.refundRepository.sumSuccessfulRefunds(paymentId, { transaction });
    if (toDecimal(total).gt(payment.amount))
      throw new RefundError('Successful refunds exceed the payment amount');
    const status = toDecimal(total).eq(0)
      ? 'PAID'
      : toDecimal(total).eq(payment.amount)
        ? 'REFUNDED'
        : 'PARTIALLY_REFUNDED';
    await payment.update({ status }, { transaction });
    if (status === 'REFUNDED' && this.bookingStatusService) {
      const booking = await this.bookingRepository.findById(payment.bookingId, { transaction });
      if (booking?.status === 'CANCELLED')
        await this.bookingStatusService.markRefunded({
          bookingId: booking.id,
          actor: { type: 'SYSTEM', source: 'REFUND' },
          reason: 'Payment fully refunded',
          transaction,
        });
    }
    return payment;
  }
  async getPaymentRefunds(paymentId, requestingUser, options = {}) {
    await this.paymentService.getPaymentById(paymentId, requestingUser, options);
    return this.refundRepository.findByPaymentId(paymentId, options);
  }
  async getRefundById(id, actor) {
    const refund = await this.refundRepository.findDetails(id);
    if (!refund) throw new NotFoundError('Refund not found');
    await this.#authorize(actor, refund.booking.journeyId);
    return refund;
  }
  async getRefunds(actor, options = {}) {
    if (actor.role === 'SUPER_ADMIN') return this.refundRepository.findAll({}, options);
    if (actor.role !== 'ADMIN') throw new AuthorizationError();
    const [rows] = await this.refundRepository.model.sequelize.query(
      'SELECT DISTINCT r.id FROM refunds r JOIN bookings b ON b.id=r.booking_id JOIN admin_journeys aj ON aj.journey_id=b.journey_id WHERE aj.admin_user_id=:adminUserId AND aj.is_active=TRUE',
      { replacements: { adminUserId: actor.id } }
    );
    return this.refundRepository.findAll({ id: { [Op.in]: rows.map((row) => row.id) } }, options);
  }
  async retryRefund({ refundId, actor }) {
    const refund = await this.refundRepository.findDetails(refundId);
    if (!refund) throw new NotFoundError('Refund not found');
    await this.#authorize(actor, refund.booking.journeyId);
    if (refund.status !== 'FAILED') throw new RefundError('Only failed refunds may be retried');
    if (refund.payment.method === 'BANK_SLIP') {
      await refund.update({
        status: 'PENDING_MANUAL_PROCESSING',
        failureCode: null,
        failureMessage: null,
      });
      return toRefundDto(refund);
    }
    await refund.update({ status: 'PROCESSING', failureCode: null, failureMessage: null });
    try {
      const providerRefund = await this.stripePaymentService.createRefund({
        refund,
        payment: refund.payment,
      });
      await refund.update({
        providerRefundReference: providerRefund.id,
        providerResponse: { id: providerRefund.id, status: providerRefund.status },
      });
      if (providerRefund.status === 'succeeded') {
        await this.refundRepository.markCompleted(refund);
        await this.updatePaymentRefundStatus(refund.paymentId);
      }
      return toRefundDto(refund);
    } catch (error) {
      await this.refundRepository.markFailed(refund, {
        failureCode: error.code || 'STRIPE_REFUND_FAILED',
        failureMessage: String(error.message).slice(0, 500),
      });
      throw new RefundError('Stripe refund retry failed', undefined, { cause: error });
    }
  }
  async #authorize(actor, journeyId, transaction) {
    if (actor?.role === 'SUPER_ADMIN') return true;
    if (actor?.role !== 'ADMIN')
      throw new AuthorizationError('Only administrators may manage refunds');
    return this.accessControlService.assertAdminJourneyAccess({ actor, journeyId, transaction });
  }
}
module.exports = RefundService;
