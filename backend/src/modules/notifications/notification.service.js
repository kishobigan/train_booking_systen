'use strict';
const CHANNEL = require('../../common/constants/notification-channel.constants');
const STATUS = require('../../common/constants/notification-status.constants');
const TEMPLATE = require('../../common/constants/notification-template.constants');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const NotificationDestinationError = require('../../common/errors/NotificationDestinationError');
const NotificationProviderError = require('../../common/errors/NotificationProviderError');
const { postgresCode } = require('../../common/utils/database-error');
const logger = require('../../config/logger');
class NotificationService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
    this.clock = dependencies.clock || (() => new Date());
  }

  async queueNotification(input, options = {}) {
    if (!this.config.enabled) return null;
    if (!input.mandatory && this.config.channelEnabled?.[input.channel] === false) return null;
    const destination = this.validateDestination(input.channel, input.destination);
    const enabled = await this.notificationPreferenceService.isEnabled(
      {
        userId: input.userId,
        channel: input.channel,
        category: input.category,
        mandatory: input.mandatory,
      },
      options
    );
    if (!enabled) return null;
    const rendered = this.notificationTemplateService.render(
      input.templateCode,
      input.channel,
      input.variables
    );
    if (input.deduplicationKey) {
      const existing = await this.notificationRepository.findByDeduplicationKey(
        input.deduplicationKey,
        options
      );
      if (existing) return existing;
    }
    try {
      const notification = await this.notificationRepository.create(
        {
          userId: input.userId || null,
          bookingId: input.bookingId || null,
          journeyId: input.journeyId || null,
          channel: input.channel,
          destination,
          templateCode: input.templateCode,
          subject: rendered.subject || null,
          content: rendered.text,
          status: STATUS.PENDING,
          attemptCount: 0,
          maxAttempts: input.maxAttempts || this.config.maxAttempts,
          scheduledAt: input.scheduledAt || this.clock(),
          deduplicationKey: input.deduplicationKey || null,
          metadata: { ...(input.metadata || {}), ...(rendered.html && { html: rendered.html }) },
        },
        options
      );
      await this.#audit(notification, 'NOTIFICATION_QUEUED', options);
      return notification;
    } catch (error) {
      if (postgresCode(error) === '23505' && input.deduplicationKey)
        return this.notificationRepository.findByDeduplicationKey(input.deduplicationKey, options);
      throw error;
    }
  }
  queueEmail(input, options) {
    return this.queueNotification({ ...input, channel: CHANNEL.EMAIL }, options);
  }
  queueSms(input, options) {
    return this.queueNotification({ ...input, channel: CHANNEL.SMS }, options);
  }
  bulkQueueNotifications(inputs, options = {}) {
    return Promise.all(inputs.map((input) => this.queueNotification(input, options)));
  }

  async sendNotification({ notificationId }) {
    const notification = await this.transactionManager.execute(async (transaction) => {
      const record = await this.notificationRepository.findByIdForUpdate(
        notificationId,
        transaction
      );
      if (!record) throw new NotFoundError('Notification not found');
      if (![STATUS.PENDING, STATUS.RETRYING].includes(record.status)) return null;
      const dueAt = record.nextRetryAt || record.scheduledAt || record.createdAt;
      if (dueAt && dueAt > this.clock()) return null;
      if (record.attemptCount >= record.maxAttempts) {
        await this.notificationRepository.markFailed(
          record,
          {
            code: 'NOTIFICATION_MAX_ATTEMPTS_REACHED',
            message: 'Maximum delivery attempts reached.',
          },
          { transaction }
        );
        return null;
      }
      await this.notificationRepository.claimForProcessing(record, { transaction });
      await this.#audit(record, 'NOTIFICATION_PROCESSING', { transaction });
      return record;
    });
    if (!notification) return null;
    try {
      const result = await this.notificationDispatcherService.dispatch(notification);
      return this.markSent(notification.id, result);
    } catch (error) {
      return this.markFailed(notification.id, this.#providerFailure(error));
    }
  }
  sendNow(input) {
    return this.sendNotification(input);
  }
  async markSent(notificationId, result) {
    return this.transactionManager.execute(async (transaction) => {
      const notification = await this.notificationRepository.findByIdForUpdate(
        notificationId,
        transaction
      );
      if (!notification || notification.status !== STATUS.PROCESSING) return notification;
      await this.notificationRepository.markSent(notification, result, { transaction });
      await this.#audit(notification, 'NOTIFICATION_SENT', { transaction });
      return notification;
    });
  }
  async markFailed(notificationId, failure) {
    return this.transactionManager.execute(async (transaction) => {
      const notification = await this.notificationRepository.findByIdForUpdate(
        notificationId,
        transaction
      );
      if (!notification || notification.status !== STATUS.PROCESSING) return notification;
      const retryable = failure.retryable && notification.attemptCount < notification.maxAttempts;
      if (retryable) {
        const nextRetryAt = new Date(
          this.clock().getTime() + this.retryDelayMinutes(notification.attemptCount) * 60_000
        );
        await this.notificationRepository.markRetrying(notification, failure, nextRetryAt, {
          transaction,
        });
        await this.#audit(notification, 'NOTIFICATION_RETRY_SCHEDULED', { transaction });
      } else {
        await this.notificationRepository.markFailed(notification, failure, { transaction });
        await this.#audit(notification, 'NOTIFICATION_FAILED', { transaction });
      }
      return notification;
    });
  }
  markProcessing(notification, options) {
    return this.notificationRepository.markProcessing(notification, options);
  }
  retryDelayMinutes(attemptCount) {
    return Math.min(
      this.config.retryBaseMinutes * 2 ** Math.max(attemptCount - 1, 0),
      this.config.retryMaxMinutes
    );
  }
  async retryNotification({ notificationId, actor, overrideMaxAttempts = false }) {
    return this.transactionManager.execute(async (transaction) => {
      const notification = await this.notificationRepository.findByIdForUpdate(
        notificationId,
        transaction
      );
      if (!notification) throw new NotFoundError('Notification not found');
      await this.#assertAdminScope(notification, actor, transaction);
      if ([STATUS.SENT, STATUS.CANCELLED].includes(notification.status))
        throw new ConflictError('Notification cannot be retried in its current state');
      if (!overrideMaxAttempts && notification.attemptCount >= notification.maxAttempts)
        throw new ConflictError('Maximum notification attempts reached');
      await notification.update(
        {
          status: STATUS.RETRYING,
          nextRetryAt: this.clock(),
          failureCode: null,
          failureMessage: null,
          ...(overrideMaxAttempts && { maxAttempts: notification.attemptCount + 1 }),
        },
        { transaction }
      );
      await this.#audit(notification, 'NOTIFICATION_RETRIED', { transaction, actor });
      return notification;
    });
  }
  async cancelNotification({ notificationId, actor }) {
    return this.transactionManager.execute(async (transaction) => {
      const notification = await this.notificationRepository.findByIdForUpdate(
        notificationId,
        transaction
      );
      if (!notification) throw new NotFoundError('Notification not found');
      await this.#assertAdminScope(notification, actor, transaction);
      if (notification.status === STATUS.SENT)
        throw new ConflictError('Sent notifications cannot be cancelled');
      await this.notificationRepository.cancel(notification, { transaction });
      await this.#audit(notification, 'NOTIFICATION_CANCELLED', { transaction, actor });
      return notification;
    });
  }
  async getNotificationById(id, requestingUser) {
    const notification = await this.notificationRepository.findById(id);
    if (!notification) throw new NotFoundError('Notification not found');
    if (requestingUser?.role === 'PASSENGER' && notification.userId !== requestingUser.id)
      throw new AuthorizationError('You cannot access this notification');
    if (['ADMIN', 'SUPER_ADMIN'].includes(requestingUser?.role))
      await this.#assertAdminScope(notification, requestingUser);
    return notification;
  }
  getUserNotifications(userId, options = {}) {
    return this.notificationRepository.findByUserId(userId, options);
  }
  getBookingNotifications(bookingId, options = {}) {
    return this.notificationRepository.findByBookingId(bookingId, options);
  }
  getAdminNotifications(actor, options = {}) {
    if (actor?.role === 'SUPER_ADMIN') return this.notificationRepository.paginate({}, options);
    if (actor?.role !== 'ADMIN') throw new AuthorizationError('Administrator access is required');
    return this.notificationRepository.findForAdmin(actor.id, options);
  }

  resolveDestinations({ user, booking, channels }) {
    return channels.flatMap((channel) => {
      const destination =
        channel === CHANNEL.EMAIL
          ? booking?.contactEmail || user?.email
          : booking?.contactPhone || user?.phoneNumber;
      return destination ? [{ channel, destination }] : [];
    });
  }
  validateDestination(channel, destination) {
    const value = String(destination || '').trim();
    if (channel === CHANNEL.EMAIL) {
      if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        throw new NotificationDestinationError(
          'Invalid email destination',
          'INVALID_EMAIL_DESTINATION'
        );
      return value.toLowerCase();
    }
    if (channel === CHANNEL.SMS) {
      const normalized = value.replace(/[\s()-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(normalized))
        throw new NotificationDestinationError(
          'SMS destination must use E.164 format',
          'INVALID_SMS_DESTINATION'
        );
      return normalized;
    }
    throw new NotificationDestinationError('Unsupported notification channel');
  }
  createNotificationPayload(input) {
    return { ...input, destination: this.validateDestination(input.channel, input.destination) };
  }

  async sendBookingConfirmation({ bookingId }) {
    const booking = await this.bookingRepository.findDetails(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.status !== 'CONFIRMED') throw new ConflictError('Booking is not confirmed');
    const variables = this.#bookingVariables(booking);
    return this.#queueChannels({
      event: 'bookingConfirmation',
      category: 'booking_updates',
      mandatory: true,
      templateCode: TEMPLATE.BOOKING_CONFIRMATION,
      user: booking.user,
      booking,
      journeyId: booking.journeyId,
      variables,
      deduplicationPrefix: `booking-confirmation:${booking.id}`,
    });
  }
  async sendBookingCancellation({ bookingId, reason, refundStatus = 'PENDING_OR_NOT_APPLICABLE' }) {
    const booking = await this.bookingRepository.findDetails(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    const variables = {
      customerName: booking.contactName,
      bookingReference: booking.bookingReference,
      journeyName: booking.journey?.serviceNumber || booking.journeyId,
      cancelledAt: (booking.cancelledAt || this.clock()).toISOString(),
      reason: reason || booking.cancellationReason || 'Not provided',
      refundStatus,
    };
    return this.#queueChannels({
      event: 'bookingCancellation',
      category: 'booking_updates',
      mandatory: true,
      templateCode: TEMPLATE.BOOKING_CANCELLATION,
      user: booking.user,
      booking,
      journeyId: booking.journeyId,
      variables,
      deduplicationPrefix: `booking-cancellation:${booking.id}`,
    });
  }
  async sendWaitlistOffer({ waitlistEntryId }) {
    const entry = await this.waitlistRepository.findDetails(waitlistEntryId);
    if (!entry || entry.status !== 'OFFERED')
      throw new ConflictError('Active waitlist offer not found');
    const user =
      entry.user || (entry.userId ? await this.userRepository.findById(entry.userId) : null);
    const variables = {
      customerName: entry.contactName,
      journeyName: entry.journey?.serviceNumber || entry.journeyId,
      originStation: entry.originJourneyStation?.stationId || entry.originJourneyStationId,
      destinationStation:
        entry.destinationJourneyStation?.stationId || entry.destinationJourneyStationId,
      seatDetails: `${entry.passengerCount} seat(s) in ${entry.requestedCoachClass}`,
      offerExpiresAt: entry.offerExpiresAt.toISOString(),
      actionUrl: `${process.env.APP_BASE_URL || 'https://example.com'}/waitlist/${entry.id}`,
    };
    const booking = {
      id: null,
      contactEmail: entry.contactEmail,
      contactPhone: entry.contactPhone,
    };
    return this.#queueChannels({
      event: 'waitlistOffer',
      category: 'waitlist_updates',
      mandatory: false,
      templateCode: TEMPLATE.WAITLIST_SEAT_OFFER,
      user,
      booking,
      journeyId: entry.journeyId,
      variables,
      deduplicationPrefix: `waitlist-offer:${entry.id}:${entry.offerExpiresAt.toISOString()}`,
      metadata: { waitlistEntryId: entry.id, priority: 'HIGH' },
    });
  }
  async sendPaymentSuccess({ paymentId }) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment || payment.status !== 'PAID')
      throw new ConflictError('Verified paid payment not found');
    const booking = await this.bookingRepository.findDetails(payment.bookingId);
    const variables = {
      customerName: booking.contactName,
      paymentReference: payment.paymentReference,
      bookingReference: booking.bookingReference,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.method,
      paymentDate: payment.paidAt.toISOString(),
      bookingStatus: booking.status,
    };
    return this.#queueChannels({
      event: 'paymentSuccess',
      category: 'payment_updates',
      mandatory: true,
      templateCode: TEMPLATE.PAYMENT_SUCCESS,
      user: booking.user,
      booking,
      journeyId: booking.journeyId,
      variables,
      deduplicationPrefix: `payment-success:${payment.id}`,
    });
  }
  async sendJourneyDelay(input) {
    const journey = await this.journeyRepository.findById(input.journeyId);
    if (!journey) throw new NotFoundError('Journey not found');
    const recipients = await this.notificationRepository.findJourneyDelayRecipients(
      input.journeyId
    );
    const version = input.delayEventId || new Date(input.updatedDepartureTime).toISOString();
    const variables = {
      journeyName: journey.serviceNumber,
      previousDepartureTime: new Date(input.previousDepartureTime).toISOString(),
      updatedDepartureTime: new Date(input.updatedDepartureTime).toISOString(),
      delayMinutes: input.delayMinutes,
      reason: input.reason || 'Operational delay',
    };
    const payloads = [];
    const seen = new Set();
    for (const recipient of recipients)
      for (const channel of this.config.defaultChannels.journeyDelay) {
        const destination = channel === CHANNEL.EMAIL ? recipient.email : recipient.phone;
        if (!destination) continue;
        const normalized = this.validateDestination(channel, destination);
        if (seen.has(`${channel}:${normalized}`)) continue;
        seen.add(`${channel}:${normalized}`);
        payloads.push({
          userId: recipient.userId,
          journeyId: input.journeyId,
          channel,
          destination: normalized,
          templateCode: TEMPLATE.JOURNEY_DELAY,
          variables,
          mandatory: true,
          category: 'journey_updates',
          deduplicationKey: `journey-delay:${input.journeyId}:${version}:${channel}:${normalized}`,
          metadata: { delayEventId: version },
        });
      }
    return this.bulkQueueNotifications(payloads);
  }
  bookingStatusChanged({ booking }) {
    if (booking.status === 'CONFIRMED')
      return this.#safeQueue(() => this.sendBookingConfirmation({ bookingId: booking.id }));
    if (booking.status === 'CANCELLED')
      return this.#safeQueue(() =>
        this.sendBookingCancellation({
          bookingId: booking.id,
          reason: booking.cancellationReason,
          refundStatus: 'PENDING_OR_NOT_APPLICABLE',
        })
      );
    return null;
  }
  waitlistStatusChanged({ entry, event }) {
    return event === 'OFFERED'
      ? this.#safeQueue(() => this.sendWaitlistOffer({ waitlistEntryId: entry.id }))
      : null;
  }

  async #queueChannels(input) {
    const destinations = this.resolveDestinations({
      user: input.user,
      booking: input.booking,
      channels: this.config.defaultChannels[input.event],
    });
    return Promise.all(
      destinations.map(({ channel, destination }) =>
        this.queueNotification({
          userId: input.user?.id || input.booking?.userId,
          bookingId: input.booking?.id || null,
          journeyId: input.journeyId,
          channel,
          destination,
          templateCode: input.templateCode,
          variables: input.variables,
          mandatory: input.mandatory,
          category: input.category,
          deduplicationKey: `${input.deduplicationPrefix}:${channel}`,
          metadata: input.metadata,
        })
      )
    );
  }
  #bookingVariables(booking) {
    return {
      customerName: booking.contactName,
      bookingReference: booking.bookingReference,
      journeyName: booking.journey?.serviceNumber || booking.journeyId,
      originStation: booking.originJourneyStation?.stationId || booking.originJourneyStationId,
      destinationStation:
        booking.destinationJourneyStation?.stationId || booking.destinationJourneyStationId,
      departureTime: (
        booking.originJourneyStation?.scheduledDepartureAt ||
        booking.journey?.scheduledDepartureAt ||
        this.clock()
      ).toISOString(),
      seatDetails: (booking.bookingSeats || [])
        .map((seat) => `${seat.coachNumberSnapshot}-${seat.seatNumberSnapshot}`)
        .join(', '),
      totalAmount: booking.totalAmount,
      currency: booking.currency,
    };
  }
  #providerFailure(error) {
    if (error instanceof NotificationProviderError)
      return {
        retryable: error.retryable,
        code: error.code,
        message: String(error.message).slice(0, 500),
      };
    return {
      retryable: true,
      code: 'NOTIFICATION_PROVIDER_FAILED',
      message: 'Temporary provider failure.',
    };
  }
  async #safeQueue(operation) {
    try {
      return await operation();
    } catch (error) {
      logger.error({ code: error.code }, 'Post-commit notification queueing failed');
      return null;
    }
  }
  async #assertAdminScope(notification, actor, transaction) {
    if (actor?.role === 'SUPER_ADMIN') return true;
    if (actor?.role !== 'ADMIN') throw new AuthorizationError('Administrator access is required');
    let journeyId = notification.journeyId;
    if (!journeyId && notification.bookingId)
      journeyId = (await this.bookingRepository.findById(notification.bookingId, { transaction }))
        ?.journeyId;
    if (!journeyId) throw new AuthorizationError('Notification has no administrable journey scope');
    return this.accessControlService.assertAdminJourneyAccess({ actor, journeyId, transaction });
  }
  #audit(notification, action, options = {}) {
    if (!this.auditService?.record) return null;
    return this.auditService.record(
      {
        userId: options.actor?.id || null,
        action,
        entityType: 'Notification',
        entityId: notification.id,
        newValues: {
          templateCode: notification.templateCode,
          channel: notification.channel,
          bookingId: notification.bookingId,
          journeyId: notification.journeyId,
          providerName: notification.providerName,
          failureCode: notification.failureCode,
        },
      },
      options.transaction ? { transaction: options.transaction } : {}
    );
  }
}
module.exports = NotificationService;
