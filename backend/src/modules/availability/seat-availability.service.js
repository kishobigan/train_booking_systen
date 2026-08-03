'use strict';
const NotFoundError = require('../../common/errors/NotFoundError');
const InvalidJourneySegmentError = require('../../common/errors/InvalidJourneySegmentError');
const SeatUnavailableError = require('../../common/errors/SeatUnavailableError');
const ValidationError = require('../../common/errors/ValidationError');
const JOURNEY_STATUS = require('../../common/constants/journey-status.constants');
const {
  createSegment,
  isValidSegment,
  segmentsAreAdjacent,
} = require('../../common/utils/segment-overlap');
const money = require('../../common/utils/money');

class SeatAvailabilityService {
  constructor({
    journeyRepository,
    journeyStationRepository,
    journeyCoachRepository,
    journeySeatRepository,
    availabilityRepository,
    activeSeatAllocationRepository,
  }) {
    this.journeyRepository = journeyRepository;
    this.journeyStationRepository = journeyStationRepository;
    this.journeyCoachRepository = journeyCoachRepository;
    this.journeySeatRepository = journeySeatRepository;
    this.availabilityRepository = availabilityRepository;
    this.activeSeatAllocationRepository = activeSeatAllocationRepository;
  }

  /** Validate journey, stations, boarding rules, order and positive distance. */
  async validateJourneySegment(input, options = {}) {
    const journey = await this.journeyRepository.findById(input.journeyId, options);
    if (!journey) throw new NotFoundError('Journey not found');
    if (journey.status === JOURNEY_STATUS.CANCELLED)
      throw new InvalidJourneySegmentError('Cancelled journeys are unavailable');
    const [origin, destination] = await this.journeyStationRepository.findOriginAndDestination(
      input.journeyId,
      input.originJourneyStationId,
      input.destinationJourneyStationId,
      options
    );
    if (!origin || !destination) throw new NotFoundError('Journey station not found');
    if (!origin.canBoard)
      throw new InvalidJourneySegmentError('Boarding is not allowed at the origin');
    if (!destination.canAlight)
      throw new InvalidJourneySegmentError('Alighting is not allowed at the destination');
    const originSequence = Number(origin.sequenceNumber);
    const destinationSequence = Number(destination.sequenceNumber);
    if (!isValidSegment(originSequence, destinationSequence)) {
      throw new InvalidJourneySegmentError(
        'The selected origin must appear before the destination'
      );
    }
    const segment = createSegment(originSequence, destinationSequence);
    if (money.toDecimal(destination.distanceFromStartKm).minus(origin.distanceFromStartKm).lte(0)) {
      throw new InvalidJourneySegmentError('Journey distance must be greater than zero');
    }
    return {
      journey,
      origin: this.#station(origin),
      destination: this.#station(destination),
      segment,
    };
  }

  /** Resolve journey-station IDs into segment sequence numbers. */
  async resolveSegmentSequences(input, options = {}) {
    return this.validateJourneySegment(input, options);
  }

  /** Check one seat across a half-open journey segment. */
  async checkSeatAvailability(input) {
    const options = input.transaction ? { transaction: input.transaction } : {};
    const segment = createSegment(Number(input.originSequence), Number(input.destinationSequence));
    const seat = await this.availabilityRepository.findSeatWithCoach(input.journeySeatId, options);
    if (!seat) throw new NotFoundError('Journey seat not found');
    if (seat.journeyId !== input.journeyId)
      throw new ValidationError('Journey seat does not belong to the journey');
    const coach = seat.journeyCoach;
    const intrinsicallyAvailable =
      seat.status === 'AVAILABLE' &&
      coach?.isAvailable &&
      coach?.reservationTypeSnapshot === 'RESERVED' &&
      seat.seat?.isActive;
    const conflict = intrinsicallyAvailable
      ? await this.findConflictingAllocation({
          journeyId: input.journeyId,
          seatId: seat.seatId,
          ...segment,
          transaction: input.transaction,
        })
      : null;
    return this.#seatResult(seat, segment, intrinsicallyAvailable && !conflict, conflict);
  }

  /** Preview availability for multiple distinct seats and return every conflict. */
  async checkMultipleSeatsAvailability(input) {
    if (!Array.isArray(input.journeySeatIds) || !input.journeySeatIds.length)
      throw new ValidationError('At least one journey seat is required');
    if (new Set(input.journeySeatIds).size !== input.journeySeatIds.length)
      throw new ValidationError('journeySeatIds cannot contain duplicates');
    const seats = await Promise.all(
      input.journeySeatIds.map((journeySeatId) =>
        this.checkSeatAvailability({ ...input, journeySeatId })
      )
    );
    const availableCount = seats.filter((seat) => seat.available).length;
    return {
      allAvailable: availableCount === seats.length,
      requestedCount: seats.length,
      availableCount,
      unavailableCount: seats.length - availableCount,
      seats,
    };
  }

  /** Search reserved-coach seats available for a validated station segment. */
  async getAvailableSeats(input, options = {}) {
    const resolved = await this.validateJourneySegment(input, options);
    const page = Math.max(Number(input.page) || 1, 1);
    const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);
    const filters = { ...input, ...resolved.segment, page, limit };
    const [seats, totalAvailable, coachCounts] = await Promise.all([
      this.availabilityRepository.findAvailableSeats(filters, options),
      this.availabilityRepository.countAvailableSeats(filters, options),
      this.availabilityRepository.findCoachSeatCounts(filters, options),
    ]);
    return {
      journeyId: input.journeyId,
      ...resolved.segment,
      segment: {
        originJourneyStationId: input.originJourneyStationId,
        destinationJourneyStationId: input.destinationJourneyStationId,
        ...resolved.segment,
      },
      totalAvailable,
      totalAvailableSeats: totalAvailable,
      page,
      limit,
      pagination: {
        page,
        limit,
        totalItems: totalAvailable,
        totalPages: Math.ceil(totalAvailable / limit),
        hasNextPage: page * limit < totalAvailable,
        hasPreviousPage: page > 1,
      },
      coaches: this.#groupSeats(seats, coachCounts),
    };
  }

  /** Search seats unavailable for a validated station segment. */
  async getUnavailableSeats(input, options = {}) {
    const resolved = await this.validateJourneySegment(input, options);
    return this.availabilityRepository.findUnavailableSeats(
      { ...input, ...resolved.segment },
      options
    );
  }

  /** Count reserved seats available for a validated segment. */
  async getAvailableSeatCount(input, options = {}) {
    const filters = await this.#resolveFilters(input, options);
    return this.availabilityRepository.countAvailableSeats(filters, options);
  }

  /** Count reserved seats unavailable for a validated segment. */
  async getUnavailableSeatCount(input, options = {}) {
    const filters = await this.#resolveFilters(input, options);
    return this.availabilityRepository.countUnavailableSeats(filters, options);
  }

  /** Return per-coach seat counts and occupancy percentages. */
  async getCoachAvailability(input, options = {}) {
    const filters = await this.#resolveFilters(input, options);
    const coaches = await this.availabilityRepository.findCoachSeatCounts(filters, options);
    return coaches.map((coach) => ({
      ...coach,
      occupancyPercentage: this.#percentage(coach.unavailableSeats, coach.totalSeats),
    }));
  }

  async getCoachAvailabilityResponse(input, options = {}) {
    const filters = await this.#resolveFilters(input, options);
    return {
      journeyId: input.journeyId,
      segment: {
        originSequence: filters.originSequence,
        destinationSequence: filters.destinationSequence,
      },
      coaches: await this.getCoachAvailability(filters, options),
    };
  }

  /** Return journey-wide reserved-seat availability for a segment. */
  async getJourneyAvailabilitySummary(input, options = {}) {
    const filters = await this.#resolveFilters(input, options);
    const [totals, coaches] = await Promise.all([
      this.availabilityRepository.getJourneySeatTotals(filters, options),
      this.getCoachAvailability(filters, options),
    ]);
    const byClass = new Map();
    for (const coach of coaches) {
      const item = byClass.get(coach.coachClass) || {
        coachClass: coach.coachClass,
        totalSeats: 0,
        availableSeats: 0,
        unavailableSeats: 0,
      };
      item.totalSeats += coach.totalSeats;
      item.availableSeats += coach.availableSeats;
      item.unavailableSeats += coach.unavailableSeats;
      byClass.set(coach.coachClass, item);
    }
    return {
      journeyId: input.journeyId,
      segment: {
        originSequence: filters.originSequence,
        destinationSequence: filters.destinationSequence,
      },
      ...totals,
      occupancyPercentage: this.#percentage(totals.unavailableSeats, totals.totalReservedSeats),
      byCoachClass: [...byClass.values()],
      coaches,
    };
  }

  /** Find the first active allocation overlapping a requested segment. */
  findConflictingAllocation(input) {
    return this.availabilityRepository.findOverlappingAllocation(
      input.journeyId,
      input.seatId,
      input.originSequence,
      input.destinationSequence,
      input.transaction ? { transaction: input.transaction } : {}
    );
  }

  /** Find all active overlapping allocations for physical seats. */
  findConflictingAllocations(input) {
    return this.availabilityRepository.findOverlappingAllocations(
      input.journeyId,
      input.seatIds,
      input.originSequence,
      input.destinationSequence,
      input.transaction ? { transaction: input.transaction } : {}
    );
  }

  /** Return an internal seat allocation timeline without passenger identity. */
  async getSeatOccupancyTimeline(input, options = {}) {
    const seat = await this.availabilityRepository.findSeatWithCoach(input.journeySeatId, options);
    if (!seat || seat.journeyId !== input.journeyId)
      throw new NotFoundError('Journey seat not found');
    const allocations = await this.availabilityRepository.findSeatAllocations(
      input.journeyId,
      seat.seatId,
      options
    );
    return {
      journeySeatId: seat.id,
      seatNumber: seat.seatNumberSnapshot,
      coachNumber: seat.journeyCoach?.coachNumberSnapshot,
      allocations,
    };
  }

  /** Return seat metadata plus availability for one segment. */
  getSeatAvailabilityDetails(input) {
    return this.checkSeatAvailability(input);
  }

  /** Confirm two valid half-open segments are adjacent and non-overlapping. */
  validateAdjacentSegments(segmentA, segmentB) {
    return segmentsAreAdjacent(segmentA, segmentB);
  }

  /** Throw when a seat is unavailable. */
  async assertSeatAvailable(input) {
    const result = await this.checkSeatAvailability(input);
    if (!result.available) throw new SeatUnavailableError(undefined, { seat: result });
    return result;
  }

  /** Revalidate and lock selected seats inside the booking transaction. */
  async revalidateSeatsForBooking(input) {
    if (!input.transaction)
      throw new ValidationError('Booking-time seat validation requires a transaction');
    const seats = await this.availabilityRepository.findSeatsWithCoach(input.journeySeatIds, {
      transaction: input.transaction,
      lock: input.transaction.LOCK?.UPDATE,
      // PostgreSQL cannot apply FOR UPDATE to nullable outer-join rows. Lock the
      // journey_seats themselves; availability metadata is loaded by the
      // subsequent segment check inside this same transaction.
      include: [],
    });
    if (seats.length !== input.journeySeatIds.length) {
      throw new NotFoundError('One or more journey seats were not found');
    }
    await this.activeSeatAllocationRepository.deleteExpiredHoldsForSeats(
      input.journeyId,
      seats.map((seat) => seat.seatId),
      input.transaction
    );
    const result = await this.checkMultipleSeatsAvailability(input);
    if (!result.allAvailable)
      throw new SeatUnavailableError(undefined, {
        seats: result.seats.filter((seat) => !seat.available),
      });
    return result;
  }

  async #resolveFilters(input, options) {
    if (
      Number.isInteger(Number(input.originSequence)) &&
      Number.isInteger(Number(input.destinationSequence))
    ) {
      return {
        ...input,
        ...createSegment(Number(input.originSequence), Number(input.destinationSequence)),
      };
    }
    const resolved = await this.validateJourneySegment(input, options);
    return { ...input, ...resolved.segment };
  }
  #station(station) {
    return {
      id: station.id,
      stationId: station.stationId,
      sequenceNumber: station.sequenceNumber,
      distanceFromStartKm: station.distanceFromStartKm,
    };
  }
  #seatResult(seat, segment, available, conflict) {
    return {
      available,
      journeySeatId: seat.id,
      seatId: seat.seatId,
      seatNumber: seat.seatNumberSnapshot,
      coachNumber: seat.journeyCoach?.coachNumberSnapshot,
      coachClass: seat.journeyCoach?.coachClassSnapshot,
      segment,
      conflict: conflict
        ? {
            allocationId: conflict.id,
            originSequence: this.#rangeBound(conflict.occupiedSegment, 0),
            destinationSequence: this.#rangeBound(conflict.occupiedSegment, 1),
            allocationType: conflict.allocationType,
            expiresAt: conflict.expiresAt,
          }
        : null,
    };
  }
  #rangeBound(range, index) {
    return Array.isArray(range) ? (range[index]?.value ?? range[index]) : undefined;
  }
  #groupSeats(seats, coachCounts = []) {
    const counts = new Map(coachCounts.map((coach) => [coach.journeyCoachId, coach]));
    const coaches = new Map();
    for (const seat of seats) {
      const coach = coaches.get(seat.journeyCoachId) || {
        journeyCoachId: seat.journeyCoachId,
        coachNumber: seat.coachNumber,
        coachClass: seat.coachClass,
        availableSeatCount: 0,
        totalSeatCount: counts.get(seat.journeyCoachId)?.totalSeats || 0,
        seats: [],
      };
      coach.availableSeatCount += 1;
      coach.seats.push({
        journeySeatId: seat.journeySeatId,
        seatId: seat.seatId,
        seatNumber: seat.seatNumber,
        seatType: seat.seatType,
        isWindow: seat.isWindow,
        isAisle: seat.isAisle,
        isAccessible: seat.isAccessible,
        available: true,
      });
      coaches.set(seat.journeyCoachId, coach);
    }
    return [...coaches.values()];
  }
  #percentage(part, total) {
    return total ? money.formatDecimal(money.multiply(money.divide(part, total), 100), 2) : '0.00';
  }
}
module.exports = SeatAvailabilityService;
