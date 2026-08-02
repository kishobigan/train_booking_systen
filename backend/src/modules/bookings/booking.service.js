'use strict';
const BOOKING_STATUS = require('../../common/constants/booking-status.constants');
const JOURNEY_STATUS = require('../../common/constants/journey-status.constants');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const BookingConflictError = require('../../common/errors/BookingConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const createBookingReference = require('../../common/utils/booking-reference');
const { mapDatabaseError } = require('../../common/utils/database-error');
const money = require('../../common/utils/money');

class BookingService {
  constructor({
    bookingRepository,
    bookingPassengerService,
    bookingSeatService,
    allocationService,
    bookingStatusService,
    journeyService,
    seatAvailabilityService,
    fareCalculationService,
    paymentRepository,
    transactionManager,
    notificationService,
    auditService,
    bookingStatusRepository,
    accessControlService,
    holdMinutes = Number(process.env.BOOKING_HOLD_MINUTES || 10),
    maximumPassengers = Number(process.env.MAX_PASSENGERS_PER_BOOKING || 6),
    clock = () => new Date(),
  }) {
    Object.assign(this, {
      bookingRepository,
      bookingPassengerService,
      bookingSeatService,
      allocationService,
      bookingStatusService,
      journeyService,
      seatAvailabilityService,
      fareCalculationService,
      paymentRepository,
      transactionManager,
      notificationService,
      auditService,
      bookingStatusRepository,
      accessControlService,
    });
    this.holdMinutes = holdMinutes;
    this.maximumPassengers = maximumPassengers;
    this.clock = clock;
  }

  /** Create a complete multi-passenger booking hold in one serializable transaction. */
  async createBookingHold(rawInput) {
    const input = this.#normalizeHold(rawInput);
    this.validateBookingRequest(input);
    if (input.idempotencyKey)
      throw new ValidationError(
        'Durable idempotency is unavailable until the idempotency_keys migration is added'
      );
    const queryOptions = input.transaction ? { transaction: input.transaction } : {};
    const journey = await this.journeyService.getJourney(input.journeyId, queryOptions);
    this.validateJourneyForBooking(journey);
    this.validateBookingWindow(journey);
    const resolved = await this.seatAvailabilityService.resolveSegmentSequences(
      input,
      queryOptions
    );
    const journeySeatIds = input.passengers.map((passenger) => passenger.journeySeatId);
    const preview = await this.seatAvailabilityService.checkMultipleSeatsAvailability({
      journeyId: input.journeyId,
      journeySeatIds,
      ...resolved.segment,
      transaction: input.transaction,
    });
    if (!preview.allAvailable)
      throw new BookingConflictError('One or more selected seats are unavailable', {
        seats: preview.seats.filter((seat) => !seat.available),
      });
    const coachClasses = new Set(preview.seats.map((seat) => seat.coachClass));
    if (coachClasses.size !== 1)
      throw new ValidationError('All passengers in one booking must use the same coach class');
    const fare = await this.fareCalculationService.calculateBookingFare({
      journeyId: input.journeyId,
      originJourneyStationId: input.originJourneyStationId,
      destinationJourneyStationId: input.destinationJourneyStationId,
      coachClass: preview.seats[0].coachClass,
      passengers: input.passengers.map(({ passengerType }) => ({ passengerType })),
    });
    const operation = async (transaction) => {
      const physicalSeatIds = preview.seats.map((seat) => seat.seatId);
      await this.allocationService.repository.acquireSeatLocks({
        journeyId: input.journeyId,
        seatIds: physicalSeatIds,
        transaction,
      });
      const revalidated = await this.seatAvailabilityService.revalidateSeatsForBooking({
        journeyId: input.journeyId,
        journeySeatIds,
        ...resolved.segment,
        transaction,
      });
      const seatsById = new Map(revalidated.seats.map((seat) => [seat.journeySeatId, seat]));
      const holdExpiresAt = new Date(this.clock().getTime() + this.holdMinutes * 60_000);
      const booking = await this.bookingRepository.create(
        {
          bookingReference: this.generateBookingReference(),
          userId: input.userId,
          journeyId: input.journeyId,
          originJourneyStationId: input.originJourneyStationId,
          destinationJourneyStationId: input.destinationJourneyStationId,
          originSequence: resolved.segment.originSequence,
          destinationSequence: resolved.segment.destinationSequence,
          contactName: input.contact.fullName,
          contactEmail: input.contact.email,
          contactPhone: input.contact.phone,
          passengerCount: input.passengers.length,
          subtotal: fare.totals.passengerSubtotal,
          discountAmount: fare.totals.discountTotal,
          serviceFee: fare.totals.serviceFee,
          taxAmount: fare.totals.taxAmount,
          totalAmount: fare.totals.finalTotal,
          currency: fare.totals.currency,
          status: BOOKING_STATUS.HELD,
          holdExpiresAt,
        },
        { transaction }
      );
      const passengers = await this.bookingPassengerService.bulkCreatePassengers({
        bookingId: booking.id,
        passengers: input.passengers,
        fareBreakdown: fare,
        assignedSeatIds: input.passengers.map(
          (passenger) => seatsById.get(passenger.journeySeatId).seatId
        ),
        transaction,
      });
      const bookingSeats = await this.bookingSeatService.bulkCreateBookingSeats({
        seats: input.passengers.map((passenger, index) => {
          const seat = seatsById.get(passenger.journeySeatId);
          return {
            bookingId: booking.id,
            bookingPassengerId: passengers[index].id,
            journeyId: booking.journeyId,
            journeySeatId: seat.journeySeatId,
            seatId: seat.seatId,
            ...resolved.segment,
            status: BOOKING_STATUS.HELD,
            holdExpiresAt,
            seatNumberSnapshot: seat.seatNumber,
            coachNumberSnapshot: seat.coachNumber,
            coachClassSnapshot: seat.coachClass,
            fareAmount: fare.passengers[index].fareAfterDiscount,
          };
        }),
        transaction,
      });
      await this.allocationService.createAllocations({
        allocations: bookingSeats.map((bookingSeat) => ({
          bookingSeatId: bookingSeat.id,
          journeyId: booking.journeyId,
          seatId: bookingSeat.seatId,
          ...resolved.segment,
          allocationType: BOOKING_STATUS.HELD,
          expiresAt: holdExpiresAt,
        })),
        transaction,
      });
      await this.bookingStatusRepository.createStatusHistory(
        {
          bookingId: booking.id,
          previousStatus: null,
          newStatus: BOOKING_STATUS.HELD,
          changedByUserId: input.userId,
          reason: 'Seat hold created.',
          metadata: { source: 'booking-service' },
        },
        { transaction }
      );
      if (this.auditService?.record)
        await this.auditService.record(
          {
            userId: input.userId,
            action: 'BOOKING_CREATED',
            entityType: 'Booking',
            entityId: booking.id,
            newValues: { status: BOOKING_STATUS.HELD, journeyId: booking.journeyId },
          },
          { transaction }
        );
      transaction.afterCommit?.(() =>
        this.notificationService?.bookingStatusChanged({ booking, previousStatus: null })
      );
      return this.#holdResult(
        booking,
        resolved.segment,
        input.passengers,
        passengers,
        revalidated.seats
      );
    };
    try {
      return input.transaction
        ? await operation(input.transaction)
        : await this.transactionManager.executeSerializable(operation);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  /** Confirm an owned held booking using a locked, server-side PAID payment record. */
  confirmBooking({ bookingId, userId, paymentId, actor }) {
    return this.transactionManager.executeSerializable(async (transaction) => {
      const booking = await this.bookingRepository.findByIdForUpdate(bookingId, transaction);
      if (!booking) throw new NotFoundError('Booking not found');
      this.validateBookingOwnership(booking, { id: userId, role: actor?.role });
      const payment = await this.paymentRepository.findForUpdate(paymentId, transaction);
      if (!payment || payment.bookingId !== booking.id || payment.status !== 'PAID')
        throw new ValidationError('A verified paid payment is required');
      if (
        !money.toDecimal(payment.amount).equals(booking.totalAmount) ||
        payment.currency !== booking.currency
      )
        throw new ValidationError('Payment amount or currency does not match booking total');
      await this.allocationService.confirmBookingAllocations({ bookingId, transaction });
      const updated = await this.bookingStatusService.confirmBooking({
        bookingId,
        actor: actor || { type: 'USER', userId, role: 'PASSENGER' },
        reason: 'Payment completed.',
        transaction,
      });
      return {
        bookingId: updated.id,
        bookingReference: updated.bookingReference,
        status: updated.status,
        confirmedAt: updated.confirmedAt,
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
        },
        ticket: await this.getBookingTicket(updated.id, { transaction, skipOwnership: true }),
      };
    });
  }

  /** Cancel an owned or privileged held/confirmed booking. */
  async cancelBooking({ bookingId, requestingUser, reason, actor }) {
    const booking = await this.getBookingById(bookingId);
    await this.assertBookingAccess(booking, requestingUser);
    return this.bookingStatusService.cancelBooking({
      bookingId,
      actor: actor || { type: 'USER', userId: requestingUser?.id, role: requestingUser?.role },
      reason,
    });
  }
  /** Expire one held booking through the status state machine. */
  expireBooking(input) {
    return this.bookingStatusService.expireBooking(input);
  }
  /** Complete a confirmed booking after journey departure/completion. */
  completeBooking(input) {
    return this.bookingStatusService.completeBooking(input);
  }
  /** Get detailed booking by ID. */
  async getBookingById(id, options = {}) {
    const booking = await this.bookingRepository.findDetails(id, options);
    if (!booking) throw new NotFoundError('Booking not found');
    return booking;
  }
  /** Get detailed booking by customer reference. */
  async getBookingByReference(reference, options = {}) {
    const booking = await this.bookingRepository.findByReference(reference, options);
    if (!booking) throw new NotFoundError('Booking not found');
    return booking;
  }
  /** List bookings owned by a user. */
  getUserBookings(userId, options = {}) {
    return this.bookingRepository.findByUserId(userId, options);
  }
  /** List bookings for a journey. */
  getJourneyBookings(journeyId, options = {}) {
    return this.bookingRepository.findByJourneyId(journeyId, options);
  }
  async getScopedJourneyBookings(journeyId, actor, options = {}) {
    await this.accessControlService.assertAdminJourneyAccess({ actor, journeyId });
    return this.getJourneyBookings(journeyId, options);
  }
  /** Return compact booking totals and lifecycle data. */
  async getBookingSummary(id, options = {}) {
    const booking = await this.getBookingById(id, options);
    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      passengerCount: booking.passengerCount,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
    };
  }
  /** Return ticket-safe journey, segment, passenger and seat details. */
  async getBookingTicket(id, options = {}) {
    const booking = await this.getBookingById(id, options);
    if (!['CONFIRMED', 'COMPLETED'].includes(booking.status))
      throw new BookingConflictError('Tickets are available only for confirmed bookings');
    return {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      journey: booking.journey,
      segment: {
        originJourneyStation: booking.originJourneyStation,
        destinationJourneyStation: booking.destinationJourneyStation,
        originSequence: booking.originSequence,
        destinationSequence: booking.destinationSequence,
      },
      passengers: booking.passengers,
      seats: booking.bookingSeats,
    };
  }
  /** Validate hold request shape and disallow frontend amount fields. */
  validateBookingRequest(input) {
    if (!input.userId) throw new ValidationError('userId is required');
    if (!input.journeyId || !input.originJourneyStationId || !input.destinationJourneyStationId)
      throw new ValidationError('Journey and segment stations are required');
    this.validatePassengerCount(input.passengers?.length);
    this.bookingPassengerService.validatePassengerList(input.passengers);
    if (input.passengers.some((passenger) => !passenger.journeySeatId))
      throw new ValidationError('Every passenger requires journeySeatId');
    if (!input.contact?.fullName || (!input.contact.email && !input.contact.phone))
      throw new ValidationError('Contact name and email or phone are required');
    return input;
  }
  /** Verify passenger ownership or staff/admin authority. */
  validateBookingOwnership(booking, user) {
    if (user?.role === 'SUPER_ADMIN' || booking.userId === user?.id) return true;
    throw new AuthorizationError('You cannot access this booking');
  }
  async assertBookingAccess(booking, actor) {
    if (actor?.role === 'SUPER_ADMIN' || booking.userId === actor?.id) return true;
    if (actor?.role === 'ADMIN')
      return this.accessControlService.assertAdminJourneyAccess({
        actor,
        journeyId: booking.journeyId,
      });
    throw new AuthorizationError('You cannot access this booking');
  }
  /** Validate booking open/close timestamps against server time. */
  validateBookingWindow(journey) {
    const now = this.clock();
    if (journey.bookingOpensAt && journey.bookingOpensAt > now)
      throw new BookingConflictError('Booking has not opened');
    if (journey.bookingClosesAt && journey.bookingClosesAt <= now)
      throw new BookingConflictError('Booking has closed');
    return true;
  }
  /** Validate journey lifecycle for new bookings. */
  validateJourneyForBooking(journey) {
    if (![JOURNEY_STATUS.SCHEDULED, JOURNEY_STATUS.DELAYED].includes(journey.status))
      throw new BookingConflictError('Journey is not open for booking');
    return true;
  }
  /** Validate reserved-seat passenger count consistency. */
  validatePassengerCount(count) {
    if (!Number.isInteger(count) || count < 1 || count > this.maximumPassengers)
      throw new ValidationError(`Passenger count must be between 1 and ${this.maximumPassengers}`);
    return count;
  }
  /** Generate a non-sequential uppercase customer reference. */
  generateBookingReference() {
    return createBookingReference();
  }

  #normalizeHold(input) {
    if (input.contact) return input;
    const passengers = (input.passengers || []).map((passenger) => ({
      ...passenger,
      journeySeatId: passenger.journeySeatId || input.journeySeatId,
    }));
    return {
      ...input,
      passengers,
      contact: {
        fullName: input.contactName,
        email: input.contactEmail,
        phone: input.contactPhone,
      },
    };
  }
  #holdResult(booking, segment, requestedPassengers, passengers, seats) {
    const seatsById = new Map(seats.map((seat) => [seat.journeySeatId, seat]));
    return {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      journeyId: booking.journeyId,
      segment: {
        originJourneyStationId: booking.originJourneyStationId,
        destinationJourneyStationId: booking.destinationJourneyStationId,
        ...segment,
      },
      passengers: passengers.map((passenger, index) => {
        const seat = seatsById.get(requestedPassengers[index].journeySeatId);
        return {
          id: passenger.id,
          fullName: passenger.fullName,
          passengerType: passenger.passengerType,
          journeySeatId: seat.journeySeatId,
          seatNumber: seat.seatNumber,
          coachNumber: seat.coachNumber,
          coachClass: seat.coachClass,
          finalFare: passenger.finalFare,
        };
      }),
      totals: {
        subtotal: booking.subtotal,
        discountAmount: booking.discountAmount,
        serviceFee: booking.serviceFee,
        taxAmount: booking.taxAmount,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
      },
      holdExpiresAt: booking.holdExpiresAt,
    };
  }
}
module.exports = BookingService;
