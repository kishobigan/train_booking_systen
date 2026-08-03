'use strict';
const { QueryTypes } = require('sequelize');
const sequelize = require('../../database/sequelize');

class ReportRepository {
  constructor(database = sequelize) {
    this.database = database;
  }
  findJourneyIdsByTrainIds(trainIds, options = {}) {
    if (!trainIds.length) return Promise.resolve([]);
    return this.query('SELECT id FROM journeys WHERE train_id = ANY(CAST(:trainIds AS UUID[]))', { trainIds }, options).then(rows => rows.map(row => row.id));
  }
  findJourneyIdsByStationIds(stationIds, options = {}) {
    if (!stationIds.length) return Promise.resolve([]);
    return this.query(
      'SELECT DISTINCT journey_id AS id FROM journey_stations WHERE station_id = ANY(CAST(:stationIds AS UUID[]))',
      { stationIds }, options
    ).then(rows => rows.map(row => row.id));
  }

  query(sql, replacements, options = {}) {
    const normalized = {
      ...replacements,
      journeyIds: this.#postgresUuidArray(replacements.journeyIds),
      trainIds: this.#postgresUuidArray(replacements.trainIds),
      stationIds: this.#postgresUuidArray(replacements.stationIds),
    };
    return this.database.query(sql, {
      ...options,
      replacements: normalized,
      type: QueryTypes.SELECT,
    });
  }

  #postgresUuidArray(values) {
    if (!Array.isArray(values)) return values;
    return `{${values.join(',')}}`;
  }

  getBookingStatusCounts(scope, options = {}) {
    return this.query(
      `SELECT status, COUNT(*)::INTEGER AS count FROM bookings
       WHERE created_at >= :dateFrom AND created_at < :dateToExclusive
         AND (:allJourneys OR journey_id = ANY(CAST(:journeyIds AS UUID[])))
       GROUP BY status`,
      scope,
      options
    );
  }

  getPaymentStatusCounts(scope, options = {}) {
    return this.query(
      `SELECT p.status, COUNT(*)::INTEGER AS count FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       WHERE p.created_at >= :dateFrom AND p.created_at < :dateToExclusive
         AND (:allJourneys OR b.journey_id = ANY(CAST(:journeyIds AS UUID[])))
       GROUP BY p.status`,
      scope,
      options
    );
  }

  getWaitlistStatusCounts(scope, options = {}) {
    return this.query(
      `SELECT status, COUNT(*)::INTEGER AS count FROM waitlist_entries
       WHERE created_at >= :dateFrom AND created_at < :dateToExclusive
         AND (:allJourneys OR journey_id = ANY(CAST(:journeyIds AS UUID[])))
       GROUP BY status`,
      scope,
      options
    );
  }

  getRevenueSummary(scope, options = {}) {
    return this.query(
      `WITH paid AS (
         SELECT COALESCE(SUM(p.amount), 0) AS amount FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         WHERE p.status = 'PAID' AND p.created_at >= :dateFrom AND p.created_at < :dateToExclusive
           AND (:allJourneys OR b.journey_id = ANY(CAST(:journeyIds AS UUID[])))
       ), refunded AS (
         SELECT COALESCE(SUM(r.amount), 0) AS amount FROM refunds r
         JOIN bookings b ON b.id = r.booking_id
         WHERE r.status = 'REFUNDED' AND r.processed_at >= :dateFrom AND r.processed_at < :dateToExclusive
           AND (:allJourneys OR b.journey_id = ANY(CAST(:journeyIds AS UUID[])))
       ) SELECT paid.amount::TEXT AS "grossRevenue", refunded.amount::TEXT AS "refundAmount"
       FROM paid CROSS JOIN refunded`,
      scope,
      options
    ).then((rows) => rows[0]);
  }

  getRevenueByPaymentMethod(scope, options = {}) {
    return this.query(
      `SELECT p.method, SUM(p.amount)::TEXT AS "paidAmount", COUNT(*)::INTEGER AS "paymentCount"
       FROM payments p JOIN bookings b ON b.id = p.booking_id
       WHERE p.status = 'PAID' AND p.created_at >= :dateFrom AND p.created_at < :dateToExclusive
         AND (:allJourneys OR b.journey_id = ANY(CAST(:journeyIds AS UUID[])))
       GROUP BY p.method ORDER BY p.method`,
      scope,
      options
    );
  }

  getJourneyRevenue(scope, options = {}) {
    return this.query(
      `SELECT j.id AS "journeyId", j.service_number AS "serviceNumber",
         COALESCE(SUM(p.amount), 0)::TEXT AS revenue,
         COUNT(DISTINCT b.id) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED'))::INTEGER AS "confirmedBookings"
       FROM journeys j JOIN bookings b ON b.journey_id = j.id JOIN payments p ON p.booking_id = b.id
       WHERE p.status = 'PAID' AND p.created_at >= :dateFrom AND p.created_at < :dateToExclusive
         AND (:allJourneys OR j.id = ANY(CAST(:journeyIds AS UUID[])))
       GROUP BY j.id, j.service_number ORDER BY SUM(p.amount) DESC`,
      scope,
      options
    );
  }

  getRevenueTrend(scope, groupBy, options = {}) {
    const unit = { day: 'day', week: 'week', month: 'month' }[groupBy] || 'day';
    return this.query(
      `SELECT DATE_TRUNC('${unit}', p.paid_at)::DATE::TEXT AS period,
         SUM(p.amount)::TEXT AS "grossRevenue"
       FROM payments p JOIN bookings b ON b.id = p.booking_id
       WHERE p.status = 'PAID' AND p.paid_at >= :dateFrom AND p.paid_at < :dateToExclusive
         AND (:allJourneys OR b.journey_id = ANY(CAST(:journeyIds AS UUID[])))
       GROUP BY 1 ORDER BY 1`,
      scope,
      options
    );
  }

  getSegmentOccupancy(scope, options = {}) {
    return this.query(
      `WITH segments AS (
         SELECT js.journey_id, js.sequence_number, js.station_id AS from_station_id,
           LEAD(js.station_id) OVER (PARTITION BY js.journey_id ORDER BY js.sequence_number) AS to_station_id
         FROM journey_stations js
         WHERE (:allJourneys OR js.journey_id = ANY(CAST(:journeyIds AS UUID[])))
       ), capacity AS (
         SELECT journey_id, COUNT(*)::INTEGER AS total_seats FROM journey_seats
         WHERE status = 'AVAILABLE' GROUP BY journey_id
       )
       SELECT s.journey_id AS "journeyId", s.sequence_number AS "sequenceNumber",
         fs.id AS "fromStationId", fs.code AS "fromCode", fs.name AS "fromName",
         ts.id AS "toStationId", ts.code AS "toCode", ts.name AS "toName",
         COALESCE(c.total_seats, 0)::INTEGER AS "totalSeats",
         COUNT(DISTINCT asa.seat_id) FILTER (WHERE asa.allocation_type = 'CONFIRMED')::INTEGER AS "occupiedSeats"
       FROM segments s JOIN stations fs ON fs.id = s.from_station_id
       JOIN stations ts ON ts.id = s.to_station_id LEFT JOIN capacity c ON c.journey_id = s.journey_id
       LEFT JOIN active_seat_allocations asa ON asa.journey_id = s.journey_id
         AND asa.occupied_segment @> s.sequence_number AND asa.allocation_type = 'CONFIRMED'
       WHERE s.to_station_id IS NOT NULL GROUP BY s.journey_id, s.sequence_number,
         fs.id, fs.code, fs.name, ts.id, ts.code, ts.name, c.total_seats
       ORDER BY s.journey_id, s.sequence_number`,
      scope,
      options
    );
  }
}
module.exports = ReportRepository;
