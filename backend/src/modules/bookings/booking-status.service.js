'use strict';
const sequelize = require('../../database/sequelize');
const BOOKING_STATUS = require('../../common/constants/booking-status.constants');
const BookingStatusError = require('../../common/errors/BookingStatusError');
const BookingExpiredError = require('../../common/errors/BookingExpiredError');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const NotFoundError = require('../../common/errors/NotFoundError');

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: Object.freeze(['HELD', 'CANCELLED']),
  HELD: Object.freeze(['CONFIRMED', 'EXPIRED', 'CANCELLED']),
  CONFIRMED: Object.freeze(['CANCELLED', 'COMPLETED']),
  CANCELLED: Object.freeze(['REFUNDED']),
  EXPIRED: Object.freeze([]),
  COMPLETED: Object.freeze([]),
  REFUNDED: Object.freeze([]),
});

class BookingStatusService {
  constructor({
    bookingRepository,
    bookingStatusRepository,
    bookingSeatRepository,
    allocationRepository,
    paymentRepository,
    refundRepository,
    notificationService,
    auditService,
    transactionManager = sequelize,
    clock = () => new Date(),
  }) {
    this.bookingRepository = bookingRepository;
    this.bookingStatusRepository = bookingStatusRepository;
    this.bookingSeatRepository = bookingSeatRepository;
    this.allocationRepository = allocationRepository;
    this.paymentRepository = paymentRepository;
    this.refundRepository = refundRepository;
    this.notificationService = notificationService;
    this.auditService = auditService;
    this.transactionManager = transactionManager;
    this.clock = clock;
  }

  /** Atomically apply a valid status transition and related side effects. */
  transitionBookingStatus(input) {
    const operation = async (transaction) => {
      const booking = await this.bookingStatusRepository.findBookingForUpdate(
        this.bookingRepository,
        input.bookingId,
        transaction
      );
      if (!booking) throw new NotFoundError('Booking not found');
      await this.validateTransition({
        currentStatus: booking.status,
        targetStatus: input.targetStatus,
        booking,
        actor: input.actor,
        reason: input.reason,
        transaction,
      });
      const previousStatus = booking.status;
      const updates = this.#bookingUpdates(input.targetStatus, input.reason);
      const updated = await this.bookingStatusRepository.updateBookingStatus(
        booking,
        { status: input.targetStatus, ...updates },
        { transaction }
      );
      await this.bookingStatusRepository.updateBookingSeatStatuses(
        this.bookingSeatRepository,
        booking.id,
        input.targetStatus,
        { transaction }
      );
      if (
        [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.EXPIRED, BOOKING_STATUS.COMPLETED].includes(
          input.targetStatus
        )
      ) {
        await this.allocationRepository.deleteByBooking(booking.id, { transaction });
      } else if (input.targetStatus === BOOKING_STATUS.CONFIRMED) {
        await this.allocationRepository.updateByBooking(
          booking.id,
          { allocationType: BOOKING_STATUS.CONFIRMED, expiresAt: null },
          { transaction }
        );
      }
      await this.recordStatusHistory(
        {
          bookingId: booking.id,
          previousStatus,
          newStatus: input.targetStatus,
          actor: input.actor,
          reason: input.reason,
          metadata: input.metadata,
        },
        { transaction }
      );
      if (this.auditService?.record)
        await this.auditService.record(
          {
            userId: input.actor?.userId,
            action: 'BOOKING_STATUS_CHANGED',
            entityType: 'Booking',
            entityId: booking.id,
            oldValues: { status: previousStatus },
            newValues: { status: input.targetStatus },
          },
          { transaction }
        );
      transaction.afterCommit?.(() => this.#notify(updated, previousStatus));
      return updated;
    };
    if (input.transaction) return operation(input.transaction);
    if (typeof this.transactionManager.execute === 'function') {
      return this.transactionManager.execute(operation);
    }
    return this.transactionManager.transaction(operation);
  }

  /** Validate transition map, permissions and status-specific prerequisites. */
  async validateTransition({ currentStatus, targetStatus, booking, actor, reason, transaction }) {
    if (!ALLOWED_TRANSITIONS[currentStatus] || !ALLOWED_TRANSITIONS[targetStatus])
      throw new BookingStatusError('Unknown booking status');
    if (currentStatus === targetStatus || !this.canTransition(currentStatus, targetStatus))
      throw new BookingStatusError(
        `Booking cannot transition from ${currentStatus} to ${targetStatus}.`
      );
    this.#authorize(actor, targetStatus, booking);
    if (
      [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.EXPIRED, BOOKING_STATUS.REFUNDED].includes(
        targetStatus
      ) &&
      !String(reason || '').trim()
    )
      throw new BookingStatusError('A transition reason is required');
    if (targetStatus === BOOKING_STATUS.CONFIRMED) {
      if (booking.holdExpiresAt && booking.holdExpiresAt <= this.clock())
        throw new BookingExpiredError();
      if (!(await this.paymentRepository.findSuccessfulByBooking(booking.id, { transaction })))
        throw new BookingStatusError('Successful payment is required before confirmation', {
          code: 'BOOKING_PAYMENT_REQUIRED',
        });
    }
    if (
      targetStatus === BOOKING_STATUS.REFUNDED &&
      !(await this.refundRepository.findSuccessfulByBooking(booking.id, { transaction }))
    )
      throw new BookingStatusError('Successful refund is required before marking refunded', {
        code: 'BOOKING_REFUND_REQUIRED',
      });
    if (
      targetStatus === BOOKING_STATUS.COMPLETED &&
      !['DEPARTED', 'COMPLETED'].includes(booking.journey?.status)
    )
      throw new BookingStatusError('The journey must have departed before booking completion');
    return true;
  }

  /** Return whether a transition appears in the explicit state map. */
  canTransition(currentStatus, targetStatus) {
    return Boolean(ALLOWED_TRANSITIONS[currentStatus]?.includes(targetStatus));
  }
  /** Return allowed targets for a booking status. */
  getAllowedTransitions(status) {
    return [...(ALLOWED_TRANSITIONS[status] || [])];
  }
  /** Append an immutable status-history record. */
  recordStatusHistory(input, options = {}) {
    return this.bookingStatusRepository.createStatusHistory(
      {
        bookingId: input.bookingId,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        changedByUserId: input.actor?.type === 'USER' ? input.actor.userId : null,
        reason: input.reason,
        metadata: {
          ...(input.metadata || {}),
          actorType: input.actor?.type,
          actorRole: input.actor?.role,
          source: input.actor?.source,
        },
      },
      options
    );
  }

  /** Return authorized, privacy-filtered booking status history. */
  async getStatusHistory({ bookingId, requestingUser }, options = {}) {
    const booking = await this.bookingRepository.findById(bookingId, options);
    if (!booking) throw new NotFoundError('Booking not found');
    const privileged = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(requestingUser?.role);
    if (!privileged && booking.userId !== requestingUser?.id)
      throw new AuthorizationError('You cannot view this booking history');
    const history = await this.bookingStatusRepository.getStatusHistory(bookingId, options);
    return {
      bookingId,
      currentStatus: booking.status,
      history: history.map((item) => ({
        previousStatus: item.previousStatus,
        newStatus: item.newStatus,
        reason: item.reason,
        changedAt: item.createdAt,
        ...(privileged && { metadata: item.metadata }),
      })),
    };
  }

  /** Transition a pending booking into a hold. */
  holdBooking(input) {
    return this.transitionBookingStatus({ ...input, targetStatus: BOOKING_STATUS.HELD });
  }
  /** Confirm a paid, unexpired held booking. */
  confirmBooking(input) {
    return this.transitionBookingStatus({ ...input, targetStatus: BOOKING_STATUS.CONFIRMED });
  }
  /** Cancel a held or confirmed booking. */
  cancelBooking(input) {
    return this.transitionBookingStatus({ ...input, targetStatus: BOOKING_STATUS.CANCELLED });
  }
  /** Expire a held booking and release its allocations. */
  expireBooking(input) {
    return this.transitionBookingStatus({ ...input, targetStatus: BOOKING_STATUS.EXPIRED });
  }
  /** Complete a confirmed booking after journey departure. */
  completeBooking(input) {
    return this.transitionBookingStatus({ ...input, targetStatus: BOOKING_STATUS.COMPLETED });
  }
  /** Mark a cancelled booking refunded after a successful refund. */
  markRefunded(input) {
    return this.transitionBookingStatus({ ...input, targetStatus: BOOKING_STATUS.REFUNDED });
  }

  #authorize(actor, targetStatus, booking) {
    if (!actor) throw new AuthorizationError('A transition actor is required');
    if (actor.type === 'SYSTEM') {
      if (
        ![
          BOOKING_STATUS.CONFIRMED,
          BOOKING_STATUS.EXPIRED,
          BOOKING_STATUS.COMPLETED,
          BOOKING_STATUS.REFUNDED,
        ].includes(targetStatus)
      )
        throw new AuthorizationError('System actor cannot perform this transition');
      return;
    }
    if (['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) return;
    if (
      actor.role === 'STAFF' &&
      [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(targetStatus)
    )
      return;
    if (
      actor.role === 'PASSENGER' &&
      [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.CONFIRMED].includes(targetStatus) &&
      booking.userId === actor.userId
    )
      return;
    throw new AuthorizationError('Actor is not authorized for this transition');
  }
  #bookingUpdates(targetStatus, reason) {
    const now = this.clock();
    if (targetStatus === BOOKING_STATUS.CONFIRMED) return { confirmedAt: now, holdExpiresAt: null };
    if (targetStatus === BOOKING_STATUS.CANCELLED)
      return { cancelledAt: now, cancellationReason: reason };
    return {};
  }
  async #notify(booking, previousStatus) {
    if (this.notificationService?.bookingStatusChanged)
      await this.notificationService.bookingStatusChanged({ booking, previousStatus });
  }
}
module.exports = BookingStatusService;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
