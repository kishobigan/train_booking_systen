'use strict';
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const { validateSeatMapRequest } = require('./seatmap.validator');
const { SEAT_MAP_STATUS } = require('./seatmap.dto');
class SeatMapService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
    this.versions = new Map();
    this.redis = dependencies.redis || null;
  }
  validateSeatMapRequest(input) {
    return validateSeatMapRequest(input);
  }
  async resolveSeatMapSegment(input, options = {}) {
    const journey = await this.journeyRepository.findById(input.journeyId, options);
    if (!journey) throw new NotFoundError('Journey not found');
    const [origin, destination] = await this.journeyStationRepository.findOriginAndDestination(
      input.journeyId,
      input.originJourneyStationId,
      input.destinationJourneyStationId,
      options
    );
    if (!origin || !destination || origin.sequenceNumber >= destination.sequenceNumber)
      throw new ValidationError('Invalid journey segment');
    if (!origin.canBoard || !destination.canAlight)
      throw new ValidationError('Boarding or alighting is unavailable for this segment');
    return {
      journey,
      origin,
      destination,
      segment: {
        originJourneyStationId: origin.id,
        destinationJourneyStationId: destination.id,
        originSequence: origin.sequenceNumber,
        destinationSequence: destination.sequenceNumber,
      },
    };
  }
  async getSeatMap(input, options = {}) {
    return this.getSeatMapSnapshot(input, options);
  }
  async getSeatMapSnapshot(rawInput, options = {}) {
    const input = this.validateSeatMapRequest(rawInput);
    const resolved = await this.resolveSeatMapSegment(input, options);
    const rows = await this.seatMapRepository.getJourneySeatMap(
      { ...input, ...resolved.segment },
      options
    );
    return this.buildSeatMapResponse({
      input,
      resolved,
      rows,
      version: await this.getSeatMapVersion(input.journeyId),
    });
  }
  getCoachSeatMap(input, options = {}) {
    return this.getSeatMapSnapshot(input, options);
  }
  async getSeatMapVersion(journeyId) {
    if (this.redis?.isOpen)
      return String((await this.redis.get(`seatmap:version:${journeyId}`)) || 0);
    return String(this.versions.get(journeyId) || 0);
  }
  async incrementVersion(journeyId) {
    if (this.redis?.isOpen) return String(await this.redis.incr(`seatmap:version:${journeyId}`));
    const value = (this.versions.get(journeyId) || 0) + 1;
    this.versions.set(journeyId, value);
    return String(value);
  }
  getChangedSeatsSinceVersion() {
    return null;
  }
  buildSeatState(row, journey) {
    let status = SEAT_MAP_STATUS.AVAILABLE;
    if (['CANCELLED', 'COMPLETED'].includes(journey.status)) status = SEAT_MAP_STATUS.UNAVAILABLE;
    else if (!row.coachAvailable || row.reservationType !== 'RESERVED' || !row.seatActive)
      status = SEAT_MAP_STATUS.UNAVAILABLE;
    else if (row.journeySeatStatus === 'MAINTENANCE') status = SEAT_MAP_STATUS.MAINTENANCE;
    else if (row.journeySeatStatus === 'BLOCKED') status = SEAT_MAP_STATUS.BLOCKED;
    else if (row.journeySeatStatus !== 'AVAILABLE') status = SEAT_MAP_STATUS.UNAVAILABLE;
    else if (row.allocationType === 'CONFIRMED') status = SEAT_MAP_STATUS.CONFIRMED;
    else if (row.waitlistOffer) status = SEAT_MAP_STATUS.WAITLIST_OFFERED;
    else if (row.allocationType === 'HELD') status = SEAT_MAP_STATUS.HELD;
    return {
      status,
      selectable: status === SEAT_MAP_STATUS.AVAILABLE,
      holdExpiresAt:
        status === SEAT_MAP_STATUS.HELD || status === SEAT_MAP_STATUS.WAITLIST_OFFERED
          ? row.holdExpiresAt
          : null,
    };
  }
  buildSeatMapResponse({ resolved, rows, version }) {
    const coaches = new Map();
    for (const row of rows) {
      const state = this.buildSeatState(row, resolved.journey);
      if (!coaches.has(row.journeyCoachId))
        coaches.set(row.journeyCoachId, {
          journeyCoachId: row.journeyCoachId,
          coachId: row.coachId,
          coachNumber: row.coachNumber,
          coachClass: row.coachClass,
          reservationType: row.reservationType,
          positionNumber: row.positionNumber,
          isAvailable: row.coachAvailable,
          layout: row.layout || {},
          summary: { totalSeats: 0, availableSeats: 0, unavailableSeats: 0 },
          seats: [],
        });
      const coach = coaches.get(row.journeyCoachId);
      coach.summary.totalSeats += 1;
      coach.summary[state.selectable ? 'availableSeats' : 'unavailableSeats'] += 1;
      coach.seats.push({
        journeySeatId: row.journeySeatId,
        seatId: row.seatId,
        seatNumber: row.seatNumber,
        rowNumber: row.rowNumber,
        columnNumber: row.columnNumber,
        seatType: row.seatType,
        isWindow: row.isWindow,
        isAisle: row.isAisle,
        isAccessible: row.isAccessible,
        ...state,
      });
    }
    const list = [...coaches.values()];
    const total = list.reduce((sum, coach) => sum + coach.summary.totalSeats, 0);
    const available = list.reduce((sum, coach) => sum + coach.summary.availableSeats, 0);
    const now = new Date();
    return {
      journeyId: resolved.journey.id,
      segment: resolved.segment,
      version,
      generatedAt: now.toISOString(),
      journey: {
        serviceNumber: resolved.journey.serviceNumber,
        status: resolved.journey.status,
        bookingOpen:
          !resolved.journey.bookingOpensAt || resolved.journey.bookingOpensAt <= now
            ? !resolved.journey.bookingClosesAt || resolved.journey.bookingClosesAt > now
            : false,
      },
      coaches: list,
      summary: {
        totalReservedSeats: total,
        availableSeats: available,
        unavailableSeats: total - available,
      },
    };
  }
}
module.exports = SeatMapService;
