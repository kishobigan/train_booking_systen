'use strict';
const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../../database/sequelize');
const { JourneySeat, JourneyCoach, Seat, ActiveSeatAllocation } = require('../../models');

class AvailabilityRepository {
  constructor({ queryProvider = sequelize, now = () => new Date() } = {}) {
    this.queryProvider = queryProvider;
    this.now = now;
  }

  findSeatWithCoach(journeySeatId, options = {}) {
    return JourneySeat.findByPk(journeySeatId, {
      ...options,
      include: options.include || [
        { model: Seat, as: 'seat' },
        { model: JourneyCoach, as: 'journeyCoach' },
      ],
    });
  }

  findSeatsWithCoach(journeySeatIds, options = {}) {
    return JourneySeat.findAll({
      ...options,
      where: { id: { [Op.in]: journeySeatIds } },
      include: options.include || [
        { model: Seat, as: 'seat' },
        { model: JourneyCoach, as: 'journeyCoach' },
      ],
    });
  }

  findOverlappingAllocation(journeyId, seatId, originSequence, destinationSequence, options = {}) {
    return ActiveSeatAllocation.findOne({
      ...options,
      where: this.#activeOverlapWhere(journeyId, seatId, originSequence, destinationSequence),
      order: [['createdAt', 'ASC']],
    });
  }

  findOverlappingAllocations(
    journeyId,
    seatIds,
    originSequence,
    destinationSequence,
    options = {}
  ) {
    return ActiveSeatAllocation.findAll({
      ...options,
      where: {
        ...this.#activeOverlapWhere(
          journeyId,
          { [Op.in]: seatIds },
          originSequence,
          destinationSequence
        ),
      },
    });
  }

  findSeatAllocations(journeyId, seatId, options = {}) {
    return this.queryProvider.query(
      `SELECT asa.id, lower(asa.occupied_segment) AS "originSequence",
              upper(asa.occupied_segment) AS "destinationSequence",
              asa.allocation_type AS "allocationType", asa.expires_at AS "expiresAt",
              b.booking_reference AS "bookingReference",
              os.name AS "originStationName", ds.name AS "destinationStationName"
       FROM active_seat_allocations asa
       JOIN booking_seats bs ON bs.id = asa.booking_seat_id
       JOIN bookings b ON b.id = bs.booking_id
       LEFT JOIN journey_stations ojs ON ojs.journey_id = asa.journey_id AND ojs.sequence_number = lower(asa.occupied_segment)
       LEFT JOIN stations os ON os.id = ojs.station_id
       LEFT JOIN journey_stations djs ON djs.journey_id = asa.journey_id AND djs.sequence_number = upper(asa.occupied_segment)
       LEFT JOIN stations ds ON ds.id = djs.station_id
       WHERE asa.journey_id = :journeyId AND asa.seat_id = :seatId
       ORDER BY lower(asa.occupied_segment)`,
      { ...options, replacements: { journeyId, seatId }, type: QueryTypes.SELECT }
    );
  }

  findAvailableSeats(filters, options = {}) {
    return this.#findSeats(filters, false, options);
  }
  findUnavailableSeats(filters, options = {}) {
    return this.#findSeats(filters, true, options);
  }
  async countAvailableSeats(filters, options = {}) {
    return (await this.#findSeats({ ...filters, page: 1, limit: 100000 }, false, options)).length;
  }
  async countUnavailableSeats(filters, options = {}) {
    return (await this.#findSeats({ ...filters, page: 1, limit: 100000 }, true, options)).length;
  }
  async getJourneySeatTotals(filters, options = {}) {
    const [availableSeats, unavailableSeats] = await Promise.all([
      this.countAvailableSeats(filters, options),
      this.countUnavailableSeats(filters, options),
    ]);
    return {
      totalReservedSeats: availableSeats + unavailableSeats,
      availableSeats,
      unavailableSeats,
    };
  }
  async findCoachSeatCounts(filters, options = {}) {
    const [available, unavailable] = await Promise.all([
      this.#findSeats({ ...filters, page: 1, limit: 100000 }, false, options),
      this.#findSeats({ ...filters, page: 1, limit: 100000 }, true, options),
    ]);
    const coaches = new Map();
    for (const seat of [...available, ...unavailable]) {
      const item = coaches.get(seat.journeyCoachId) || {
        journeyCoachId: seat.journeyCoachId,
        coachNumber: seat.coachNumber,
        coachClass: seat.coachClass,
        positionNumber: seat.positionNumber,
        isAvailable: seat.coachAvailable,
        totalSeats: 0,
        availableSeats: 0,
        unavailableSeats: 0,
      };
      item.totalSeats += 1;
      if (seat.available) item.availableSeats += 1;
      else item.unavailableSeats += 1;
      coaches.set(seat.journeyCoachId, item);
    }
    return [...coaches.values()];
  }

  #activeOverlapWhere(journeyId, seatId, originSequence, destinationSequence) {
    return {
      journeyId,
      seatId,
      occupiedSegment: { [Op.overlap]: [originSequence, destinationSequence] },
      [Op.or]: [
        { allocationType: 'CONFIRMED' },
        { allocationType: 'HELD', expiresAt: { [Op.gt]: this.now() } },
      ],
    };
  }

  #findSeats(filters, unavailable, options) {
    const replacements = {
      journeyId: filters.journeyId,
      originSequence: filters.originSequence,
      destinationSequence: filters.destinationSequence,
      now: this.now(),
      limit: Math.min(Math.max(Number(filters.limit) || 50, 1), 100000),
      offset:
        (Math.max(Number(filters.page) || 1, 1) - 1) *
        Math.min(Math.max(Number(filters.limit) || 50, 1), 100000),
    };
    const clauses = [];
    for (const [field, column] of [
      ['coachClass', 'jc.coach_class_snapshot'],
      ['coachNumber', 'jc.coach_number_snapshot'],
      ['seatType', 's.seat_type'],
      ['isWindow', 's.is_window'],
      ['isAisle', 's.is_aisle'],
      ['isAccessible', 's.is_accessible'],
    ]) {
      if (filters[field] !== undefined) {
        clauses.push(`AND ${column} = :${field}`);
        replacements[field] = filters[field];
      }
    }
    const availabilityExpression = `js.status = 'AVAILABLE' AND jc.is_available = TRUE AND s.is_active = TRUE AND NOT EXISTS (
      SELECT 1 FROM active_seat_allocations asa
      WHERE asa.journey_id = js.journey_id AND asa.seat_id = js.seat_id
        AND asa.occupied_segment && int4range(:originSequence, :destinationSequence, '[)')
        AND (asa.allocation_type = 'CONFIRMED' OR (asa.allocation_type = 'HELD' AND asa.expires_at > :now))
    )`;
    return this.queryProvider.query(
      `SELECT js.id AS "journeySeatId", js.seat_id AS "seatId", js.journey_coach_id AS "journeyCoachId",
              js.seat_number_snapshot AS "seatNumber", s.seat_type AS "seatType", s.is_window AS "isWindow",
              s.is_aisle AS "isAisle", s.is_accessible AS "isAccessible",
              jc.coach_number_snapshot AS "coachNumber", jc.coach_class_snapshot AS "coachClass",
              jc.position_number AS "positionNumber", jc.is_available AS "coachAvailable",
              (${availabilityExpression}) AS available
       FROM journey_seats js
       JOIN journey_coaches jc ON jc.id = js.journey_coach_id
       JOIN seats s ON s.id = js.seat_id
       WHERE js.journey_id = :journeyId AND jc.reservation_type_snapshot = 'RESERVED'
       ${clauses.join(' ')} AND (${availabilityExpression}) = :expectedAvailability
       ORDER BY jc.position_number, js.seat_number_snapshot LIMIT :limit OFFSET :offset`,
      {
        ...options,
        replacements: { ...replacements, expectedAvailability: !unavailable },
        type: QueryTypes.SELECT,
      }
    );
  }
}
module.exports = AvailabilityRepository;
