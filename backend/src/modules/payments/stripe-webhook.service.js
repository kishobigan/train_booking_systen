'use strict';
const { UniqueConstraintError } = require('sequelize');
const NotFoundError = require('../../common/errors/NotFoundError');
const PaymentAmountMismatchError = require('../../common/errors/PaymentAmountMismatchError');
const StripeWebhookError = require('../../common/errors/StripeWebhookError');
const stripeConfig = require('../../config/stripe');
const { toMinorUnits } = require('../../common/utils/money');
class StripeWebhookService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
  }
  verify(rawBody, signature) {
    if (!stripeConfig.webhookSecret)
      throw new StripeWebhookError('Stripe webhook is not configured');
    return this.stripePaymentService.constructWebhookEvent(
      rawBody,
      signature,
      stripeConfig.webhookSecret
    );
  }
  async processRawWebhook({ rawBody, signature }) {
    const event = this.verify(rawBody, signature);
    return this.processEvent(event);
  }
  async processEvent(stripeEvent) {
    let eventRecord;
    try {
      eventRecord = await this.paymentWebhookRepository.createEvent({
        providerName: 'STRIPE',
        providerEventId: stripeEvent.id,
        eventType: stripeEvent.type,
        payload: this.#safePayload(stripeEvent),
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError || error.name === 'SequelizeUniqueConstraintError')
        return { duplicate: true };
      throw error;
    }
    try {
      const result = await this.transactionManager.executeSerializable(async (transaction) => {
        const lockedEvent = await this.paymentWebhookRepository.findByProviderEventIdForUpdate(
          'STRIPE',
          stripeEvent.id,
          transaction
        );
        if (lockedEvent.processedAt) return { duplicate: true };
        await this.#dispatch(stripeEvent, transaction);
        await this.paymentWebhookRepository.markProcessed(lockedEvent, { transaction });
        await this.auditService.record(
          {
            action: 'STRIPE_WEBHOOK_PROCESSED',
            entityType: 'PaymentWebhookEvent',
            entityId: lockedEvent.id,
            newValues: { eventType: stripeEvent.type },
          },
          { transaction }
        );
        return { processed: true };
      });
      return result;
    } catch (error) {
      await this.paymentWebhookRepository.markFailed(eventRecord, error.message);
      await this.auditService.record({
        action: 'STRIPE_WEBHOOK_FAILED',
        entityType: 'PaymentWebhookEvent',
        entityId: eventRecord.id,
        newValues: { eventType: stripeEvent.type, error: error.code || error.name },
      });
      throw error;
    }
  }
  async #dispatch(event, transaction) {
    const object = event.data.object;
    if (event.type === 'payment_intent.succeeded')
      return this.handlePaymentIntentSucceeded({ intent: object, transaction });
    if (event.type === 'payment_intent.payment_failed')
      return this.#updateIntent(object, 'FAILED', transaction);
    if (event.type === 'payment_intent.processing')
      return this.#updateIntent(object, 'PROCESSING', transaction);
    if (event.type === 'payment_intent.canceled')
      return this.#updateIntent(object, 'CANCELLED', transaction);
    if (['refund.created', 'refund.updated', 'refund.failed'].includes(event.type))
      return this.#updateRefund(object, transaction);
    return null;
  }
  async handlePaymentIntentSucceeded({ intent, transaction }) {
    const payment = await this.#resolvePayment(intent, transaction);
    if (!payment) throw new NotFoundError('Internal payment not found for Stripe PaymentIntent');
    if (payment.status === 'PAID') return payment;
    if (
      toMinorUnits(payment.amount, payment.currency) !== intent.amount_received &&
      toMinorUnits(payment.amount, payment.currency) !== intent.amount
    )
      throw new PaymentAmountMismatchError();
    if (payment.currency.toLowerCase() !== intent.currency.toLowerCase())
      throw new StripeWebhookError('Stripe currency mismatch');
    await this.paymentService.markPaid(
      payment,
      {
        providerResponse: {
          id: intent.id,
          status: intent.status,
          amountReceived: intent.amount_received,
          currency: intent.currency,
        },
      },
      { transaction }
    );
    await this.paymentService.completePaidBooking({
      payment,
      actor: { type: 'SYSTEM', source: 'STRIPE_WEBHOOK' },
      transaction,
    });
    await this.auditService.record(
      {
        action: 'PAYMENT_PAID',
        entityType: 'Payment',
        entityId: payment.id,
        newValues: { provider: 'STRIPE' },
      },
      { transaction }
    );
    return payment;
  }
  async #updateIntent(intent, status, transaction) {
    const payment = await this.#resolvePayment(intent, transaction);
    if (!payment) throw new NotFoundError('Payment not found for Stripe event');
    if (['PAID', 'REFUNDED'].includes(payment.status)) return payment;
    const values =
      status === 'FAILED'
        ? {
            failureCode: intent.last_payment_error?.code,
            failureMessage: String(
              intent.last_payment_error?.message || 'Stripe payment failed'
            ).slice(0, 500),
            failedAt: new Date(),
          }
        : {};
    return this.paymentService.transition(payment, status, values, { transaction });
  }
  async #updateRefund(object, transaction) {
    const refund = await this.refundRepository.findByProviderReference(object.id, {
      transaction,
      lock: transaction.LOCK?.UPDATE ?? true,
    });
    if (!refund) return null;
    if (object.status === 'succeeded') {
      await this.refundRepository.markCompleted(
        refund,
        { providerResponse: { id: object.id, status: object.status } },
        { transaction }
      );
      return this.refundService.updatePaymentRefundStatus(refund.paymentId, transaction);
    }
    if (object.status === 'failed' || object.failure_reason) {
      await this.refundRepository.markFailed(
        refund,
        { failureCode: object.failure_reason, failureMessage: 'Stripe refund failed' },
        { transaction }
      );
      return this.refundService.updatePaymentRefundStatus(refund.paymentId, transaction);
    }
    return refund.update(
      { providerResponse: { id: object.id, status: object.status } },
      { transaction }
    );
  }
  async #resolvePayment(intent, transaction) {
    let payment = await this.paymentRepository.findByProviderReferenceForUpdate(
      intent.id,
      transaction
    );
    if (!payment && intent.metadata?.paymentId) {
      payment = await this.paymentRepository.findByIdForUpdate(
        intent.metadata.paymentId,
        transaction
      );
      if (payment && !payment.providerReference)
        await payment.update({ providerReference: intent.id }, { transaction });
    }
    return payment;
  }
  #safePayload(event) {
    const object = event.data?.object || {};
    return {
      id: event.id,
      type: event.type,
      created: event.created,
      livemode: event.livemode,
      data: {
        object: {
          id: object.id,
          object: object.object,
          status: object.status,
          amount: object.amount,
          amount_received: object.amount_received,
          currency: object.currency,
          payment_intent: object.payment_intent,
          metadata: object.metadata,
          last_payment_error: object.last_payment_error && {
            code: object.last_payment_error.code,
            message: object.last_payment_error.message,
          },
        },
      },
    };
  }
}
module.exports = StripeWebhookService;
