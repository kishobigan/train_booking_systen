'use strict';
const AuthorizationError = require('../../common/errors/AuthorizationError');
const NotFoundError = require('../../common/errors/NotFoundError');
const PaymentError = require('../../common/errors/PaymentError');
const PaymentAmountMismatchError = require('../../common/errors/PaymentAmountMismatchError');
const PaymentAlreadyProcessedError = require('../../common/errors/PaymentAlreadyProcessedError');
const PAYMENT_METHOD = require('../../common/constants/payment-method.constants');
const PAYMENT_STATUS = require('../../common/constants/payment-status.constants');
const { toDecimal, formatAmount } = require('../../common/utils/money');
const { generatePaymentReference } = require('../../common/utils/payment-reference');
const paymentConfig = require('../../config/payment');
const TRANSITIONS = Object.freeze({
  PENDING: [
    'AWAITING_PAYMENT',
    'AWAITING_VERIFICATION',
    'PROCESSING',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
  ],
  AWAITING_PAYMENT: ['PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  AWAITING_VERIFICATION: ['PAID', 'REJECTED', 'EXPIRED'],
  PROCESSING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  REJECTED: ['AWAITING_VERIFICATION', 'CANCELLED', 'EXPIRED'],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED'],
  REFUND_PENDING: ['PARTIALLY_REFUNDED', 'REFUNDED', 'PAID'],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
});
class PaymentService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
  }
  async createPayment(input) {
    if (input.method === PAYMENT_METHOD.CARD) return this.createCardPayment(input);
    if (input.method === PAYMENT_METHOD.BANK_SLIP) return this.createBankSlipPayment(input);
    throw new PaymentError('Only CARD and BANK_SLIP payment methods are supported');
  }
  async createCardPayment(input) {
    const created = await this.#createInternal({
      ...input,
      method: PAYMENT_METHOD.CARD,
      providerName: 'STRIPE',
    });
    if (created.replayed) return created.response;
    const { payment, booking } = created;
    let intent;
    try {
      intent = await this.stripePaymentService.createPaymentIntent({ payment, booking });
    } catch (error) {
      await this.paymentRepository.markFailed(payment, {
        failureCode: error.code || 'STRIPE_CREATE_FAILED',
        failureMessage: String(error.message).slice(0, 500),
      });
      throw new PaymentError('Stripe PaymentIntent creation failed', undefined, { cause: error });
    }
    await payment.update({
      providerReference: intent.id,
      status: PAYMENT_STATUS.PROCESSING,
      providerResponse: { id: intent.id, status: intent.status },
    });
    await this.auditService.record({
      userId: input.userId,
      action: 'STRIPE_PAYMENT_INTENT_CREATED',
      entityType: 'Payment',
      entityId: payment.id,
      newValues: { providerReference: intent.id },
    });
    const response = {
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      bookingId: booking.id,
      method: payment.method,
      status: payment.status,
      amount: formatAmount(payment.amount),
      currency: payment.currency,
      stripe: { paymentIntentId: intent.id, clientSecret: intent.client_secret },
    };
    await this.#completeIdempotency(created.idempotencyRecord, response, payment.id);
    return response;
  }
  async createBankSlipPayment(input) {
    if (!paymentConfig.bank.enabled) throw new PaymentError('Bank-slip payments are disabled');
    const created = await this.#createInternal({
      ...input,
      method: PAYMENT_METHOD.BANK_SLIP,
      providerName: 'MANUAL_BANK_TRANSFER',
    });
    if (created.replayed) return created.response;
    const { payment, booking } = created;
    const response = {
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      method: payment.method,
      status: payment.status,
      amount: formatAmount(payment.amount),
      currency: payment.currency,
      bankInstructions: {
        bankName: paymentConfig.bank.bankName,
        accountName: paymentConfig.bank.accountName,
        accountNumber: paymentConfig.bank.accountNumber,
        branch: paymentConfig.bank.branch,
        swiftCode: paymentConfig.bank.swiftCode,
        transferReference: payment.paymentReference,
      },
      slipUploadRequired: true,
      bookingHoldExpiresAt: booking.holdExpiresAt,
    };
    await this.#completeIdempotency(created.idempotencyRecord, response, payment.id);
    return response;
  }
  async #createInternal(input) {
    return this.transactionManager.executeSerializable(async (transaction) => {
      const idempotencyRecord = await this.idempotencyService.begin({
        scope: `payment:create:${input.userId}`,
        key: input.idempotencyKey,
        request: { bookingId: input.bookingId, method: input.method },
        transaction,
      });
      if (idempotencyRecord?.responseBody)
        return { replayed: true, response: idempotencyRecord.responseBody };
      const booking = await this.bookingRepository.findByIdForUpdate(input.bookingId, transaction);
      if (!booking) throw new NotFoundError('Booking not found');
      this.verifyPaymentOwnership(booking, { id: input.userId, role: input.role });
      this.#validateBooking(booking);
      if (await this.paymentRepository.findSuccessfulByBookingId(booking.id, { transaction }))
        throw new PaymentAlreadyProcessedError();
      if (await this.paymentRepository.findActiveAttemptByBookingId(booking.id, { transaction }))
        throw new PaymentError('An active payment attempt already exists');
      const payment = await this.paymentRepository.create(
        {
          bookingId: booking.id,
          paymentReference: generatePaymentReference(),
          method: input.method,
          status: PAYMENT_STATUS.PENDING,
          amount: booking.totalAmount,
          currency: booking.currency,
          providerName: input.providerName,
        },
        { transaction }
      );
      await this.auditService.record(
        {
          userId: input.userId,
          action: 'PAYMENT_CREATED',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: { method: payment.method, amount: payment.amount, currency: payment.currency },
        },
        { transaction }
      );
      return { payment, booking, idempotencyRecord };
    });
  }
  verifyPaymentOwnership(booking, user) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user?.role) && booking.userId !== user?.id)
      throw new AuthorizationError('You cannot access this payment');
    return true;
  }
  verifyPaymentAmount(payment, booking) {
    if (!toDecimal(payment.amount).eq(booking.totalAmount) || payment.currency !== booking.currency)
      throw new PaymentAmountMismatchError();
    return true;
  }
  async getPaymentById(id, requestingUser, options = {}) {
    const payment = await this.paymentRepository.findById(id, options);
    if (!payment) throw new NotFoundError('Payment not found');
    const booking = await this.bookingRepository.findById(payment.bookingId, options);
    this.verifyPaymentOwnership(booking, requestingUser);
    return payment;
  }
  getPaymentByReference(reference, options = {}) {
    return this.paymentRepository.findByReference(reference, options);
  }
  getBookingPayments(bookingId, options = {}) {
    return this.paymentRepository.findByBookingId(bookingId, options);
  }
  async getPaymentStatus({ paymentId, requestingUser }) {
    const payment = await this.getPaymentById(paymentId, requestingUser);
    const booking = await this.bookingRepository.findById(payment.bookingId);
    return {
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      method: payment.method,
      status: payment.status,
      amount: formatAmount(payment.amount),
      currency: payment.currency,
      paidAt: payment.paidAt,
      bookingStatus: booking.status,
    };
  }
  transition(payment, targetStatus, values = {}, options = {}) {
    if (payment.status !== targetStatus && !TRANSITIONS[payment.status]?.includes(targetStatus))
      throw new PaymentError(`Payment cannot transition from ${payment.status} to ${targetStatus}`);
    return payment.update({ status: targetStatus, ...values }, options);
  }
  markProcessing(payment, options = {}) {
    return this.transition(payment, PAYMENT_STATUS.PROCESSING, {}, options);
  }
  markPaid(payment, values = {}, options = {}) {
    return this.transition(
      payment,
      PAYMENT_STATUS.PAID,
      { paidAt: new Date(), ...values },
      options
    );
  }
  markFailed(payment, values = {}, options = {}) {
    return this.transition(
      payment,
      PAYMENT_STATUS.FAILED,
      { failedAt: new Date(), ...values },
      options
    );
  }
  markRejected(payment, values = {}, options = {}) {
    return this.transition(payment, PAYMENT_STATUS.REJECTED, values, options);
  }
  cancelPayment(payment, options = {}) {
    return this.transition(payment, PAYMENT_STATUS.CANCELLED, {}, options);
  }
  expirePayment(payment, options = {}) {
    return this.transition(payment, PAYMENT_STATUS.EXPIRED, {}, options);
  }
  getSuccessfulPayment(bookingId, options = {}) {
    return this.paymentRepository.findSuccessfulByBookingId(bookingId, options);
  }
  async completePaidBooking({ payment, actor, transaction }) {
    const booking = await this.bookingRepository.findByIdForUpdate(payment.bookingId, transaction);
    this.verifyPaymentAmount(payment, booking);
    if (payment.status !== PAYMENT_STATUS.PAID)
      throw new PaymentError('A paid payment is required');
    if (
      booking.status !== 'HELD' ||
      (booking.holdExpiresAt && booking.holdExpiresAt <= new Date())
    ) {
      await this.auditService.record(
        {
          userId: actor?.userId,
          action: 'PAYMENT_RECEIVED_BOOKING_UNAVAILABLE',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: {
            bookingStatus: booking.status,
            resolution: 'MANUAL_REVIEW_OR_REFUND_REQUIRED',
          },
        },
        { transaction }
      );
      return { booking, manualResolutionRequired: true };
    }
    const confirmed = await this.bookingStatusService.confirmBooking({
      bookingId: booking.id,
      actor: actor || { type: 'SYSTEM', source: 'PAYMENT' },
      reason: 'Verified payment received',
      transaction,
      metadata: { paymentId: payment.id },
    });
    return { booking: confirmed, manualResolutionRequired: false };
  }
  async verifyStripePayment({ paymentId }) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment || payment.providerName !== 'STRIPE')
      throw new NotFoundError('Stripe payment not found');
    const intent = await this.stripePaymentService.retrievePaymentIntent(payment.providerReference);
    return { payment, intent };
  }
  #validateBooking(booking) {
    if (booking.status !== 'HELD') throw new PaymentError('Only held bookings can be paid');
    if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date())
      throw new PaymentError('Booking hold has expired');
    if (!toDecimal(booking.totalAmount).gt(0))
      throw new PaymentError('Booking total must be greater than zero');
    if (!paymentConfig.supportedCurrencies.includes(booking.currency))
      throw new PaymentError('Unsupported payment currency');
  }
  async #completeIdempotency(record, response, resourceId) {
    if (!record) return;
    await this.idempotencyService.complete(record, {
      resourceType: 'Payment',
      resourceId,
      responseStatus: 201,
      responseBody: response,
    });
  }
}
PaymentService.TRANSITIONS = TRANSITIONS;
module.exports = PaymentService;
