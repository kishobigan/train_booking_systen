'use strict';

const sequelize = require('../../database/sequelize');
const BOOKING_STATUS = require('../../common/constants/booking-status.constants');
const BookingConflictError = require('../../common/errors/BookingConflictError');
const ValidationError = require('../../common/errors/ValidationError');
const createBookingReference = require('../../common/utils/booking-reference');

class BookingService {
  constructor({
    bookingRepository,
    bookingPassengerRepository,
    bookingSeatRepository,
    activeSeatAllocationRepository,
    fareCalculationService,
    transactionProvider = sequelize,
    holdMinutes = Number(process.env.BOOKING_HOLD_MINUTES || 15),
    clock = () => new Date(),
  }) {
    this.bookingRepository = bookingRepository;
    this.bookingPassengerRepository = bookingPassengerRepository;
    this.bookingSeatRepository = bookingSeatRepository;
    this.activeSeatAllocationRepository = activeSeatAllocationRepository;
    this.fareCalculationService = fareCalculationService;
    this.transactionProvider = transactionProvider;
    this.holdMinutes = holdMinutes;
    this.clock = clock;
  }

  /** Create a held booking using only server-calculated fare values. */
  createBookingHold(input, options = {}) {
    if (!input.contactName || (!input.contactEmail && !input.contactPhone)) {
      throw new ValidationError('Contact name and either email or phone are required');
    }
    if (!Number.isFinite(this.holdMinutes) || this.holdMinutes <= 0) {
      throw new ValidationError('Booking hold duration is invalid');
    }
    return this.#withTransaction(options, async (transactionOptions) => {
      const fare = await this.fareCalculationService.calculateBookingFare(
        {
          journeyId: input.journeyId,
          originJourneyStationId: input.originJourneyStationId,
          destinationJourneyStationId: input.destinationJourneyStationId,
          journeySeatId: input.journeySeatId,
          coachClass: input.coachClass,
          passengers: input.passengers,
        },
        transactionOptions
      );
      const holdExpiresAt = new Date(this.clock().getTime() + this.holdMinutes * 60_000);
      const selectedSeat = fare.coach.journeySeatId ? fare.coach : null;
      if (selectedSeat) {
        const conflicts = await this.activeSeatAllocationRepository.lockConflicts(
          input.journeyId,
          selectedSeat.seatId,
          fare.origin.sequenceNumber,
          fare.destination.sequenceNumber,
          transactionOptions.transaction
        );
        if (conflicts.length) {
          throw new BookingConflictError('The selected seat is no longer available');
        }
      }
      const booking = await this.bookingRepository.create(
        {
          bookingReference: createBookingReference(this.clock()),
          userId: input.userId,
          journeyId: input.journeyId,
          originJourneyStationId: input.originJourneyStationId,
          destinationJourneyStationId: input.destinationJourneyStationId,
          originSequence: fare.origin.sequenceNumber,
          destinationSequence: fare.destination.sequenceNumber,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          passengerCount: fare.passengers.length,
          subtotal: fare.totals.passengerSubtotal,
          discountAmount: fare.totals.discountTotal,
          serviceFee: fare.totals.serviceFee,
          taxAmount: fare.totals.taxAmount,
          totalAmount: fare.totals.finalTotal,
          currency: fare.totals.currency,
          status: BOOKING_STATUS.HELD,
          holdExpiresAt,
        },
        transactionOptions
      );
      const passengerRecords = await this.bookingPassengerRepository.bulkCreate(
        fare.passengers.map((calculated, index) => ({
          bookingId: booking.id,
          fullName: input.passengers[index].fullName,
          passengerType: calculated.passengerType,
          identityType: input.passengers[index].identityType,
          identityNumber: input.passengers[index].identityNumber,
          dateOfBirth: input.passengers[index].dateOfBirth,
          assignedSeatId: index === 0 ? selectedSeat?.seatId : undefined,
          fareBeforeDiscount: calculated.fareBeforeDiscount,
          discountAmount: calculated.discountAmount,
          finalFare: calculated.fareAfterDiscount,
        })),
        transactionOptions
      );
      if (selectedSeat) {
        const bookingSeat = await this.bookingSeatRepository.create(
          {
            bookingId: booking.id,
            bookingPassengerId: passengerRecords[0]?.id,
            journeyId: input.journeyId,
            journeySeatId: selectedSeat.journeySeatId,
            seatId: selectedSeat.seatId,
            originSequence: fare.origin.sequenceNumber,
            destinationSequence: fare.destination.sequenceNumber,
            status: BOOKING_STATUS.HELD,
            holdExpiresAt,
            seatNumberSnapshot: selectedSeat.seatNumber,
            coachNumberSnapshot: selectedSeat.coachNumber,
            coachClassSnapshot: selectedSeat.coachClass,
            fareAmount: fare.passengers[0].fareAfterDiscount,
          },
          transactionOptions
        );
        await this.activeSeatAllocationRepository.create(
          {
            bookingSeatId: bookingSeat.id,
            journeyId: input.journeyId,
            seatId: selectedSeat.seatId,
            occupiedSegment: [fare.origin.sequenceNumber, fare.destination.sequenceNumber],
            allocationType: BOOKING_STATUS.HELD,
            expiresAt: holdExpiresAt,
          },
          transactionOptions
        );
      }
      return { booking, passengers: passengerRecords, fareBreakdown: fare };
    });
  }

  #withTransaction(options, operation) {
    if (options.transaction) return operation(options);
    return this.transactionProvider.transaction((transaction) =>
      operation({ ...options, transaction })
    );
  }
}

module.exports = BookingService;
