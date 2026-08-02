'use strict';
const { QueryTypes } = require('sequelize');
const sequelize = require('../../database/sequelize');
class SeatMapRepository {
  constructor(database = sequelize) {
    this.database = database;
  }
  getJourneySeatMap(input, options = {}) {
    return this.database.query(
      `SELECT js.id AS "journeySeatId", js.seat_id AS "seatId", js.seat_number_snapshot AS "seatNumber",
        js.status AS "journeySeatStatus", jc.id AS "journeyCoachId", jc.coach_id AS "coachId",
        jc.coach_number_snapshot AS "coachNumber", jc.coach_class_snapshot AS "coachClass",
        jc.reservation_type_snapshot AS "reservationType", jc.position_number AS "positionNumber",
        jc.is_available AS "coachAvailable", c.seat_layout AS layout,
        s.row_number AS "rowNumber", s.column_number AS "columnNumber", s.seat_type AS "seatType",
        s.is_window AS "isWindow", s.is_aisle AS "isAisle", s.is_accessible AS "isAccessible", s.is_active AS "seatActive",
        conflict.allocation_type AS "allocationType", conflict.expires_at AS "holdExpiresAt",
        (conflict.waitlist_entry_id IS NOT NULL) AS "waitlistOffer"
       FROM journey_seats js JOIN journey_coaches jc ON jc.id = js.journey_coach_id
       JOIN coaches c ON c.id = jc.coach_id JOIN seats s ON s.id = js.seat_id
       LEFT JOIN LATERAL (
         SELECT asa.allocation_type, asa.expires_at, asa.waitlist_entry_id
         FROM active_seat_allocations asa WHERE asa.journey_id = js.journey_id AND asa.seat_id = js.seat_id
           AND asa.occupied_segment && int4range(:originSequence, :destinationSequence, '[)')
           AND (asa.allocation_type = 'CONFIRMED' OR (asa.allocation_type = 'HELD' AND asa.expires_at > NOW()))
         ORDER BY CASE asa.allocation_type WHEN 'CONFIRMED' THEN 0 ELSE 1 END LIMIT 1
       ) conflict ON TRUE
       WHERE js.journey_id = :journeyId
         AND (:coachClass IS NULL OR jc.coach_class_snapshot = CAST(:coachClass AS coach_class))
         AND (:coachNumber IS NULL OR jc.coach_number_snapshot = :coachNumber)
       ORDER BY jc.position_number, s.row_number, s.column_number, js.seat_number_snapshot`,
      {
        ...options,
        replacements: {
          ...input,
          coachClass: input.coachClass || null,
          coachNumber: input.coachNumber || null,
        },
        type: QueryTypes.SELECT,
      }
    );
  }
  getJourneyCoaches(input, options) {
    return this.getJourneySeatMap(input, options);
  }
  getJourneySeats(input, options) {
    return this.getJourneySeatMap(input, options);
  }
  getSeatStatesForSegment(input, options) {
    return this.getJourneySeatMap(input, options);
  }
  async getCoachAvailabilityForSegment(input, options) {
    return this.getJourneySeatMap(input, options);
  }
  async getSeatMapSummary(input, options) {
    return this.getJourneySeatMap(input, options);
  }
}
module.exports = SeatMapRepository;
