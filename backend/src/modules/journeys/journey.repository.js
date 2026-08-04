'use strict';
const { Op, QueryTypes } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const {
  Journey,
  JourneyStation,
  JourneyCoach,
  JourneySeat,
  Station,
  Coach,
  Route,
  Train,
} = require('../../models');
const railwayTimeZone = require('../../config/timezone');
class JourneyRepository extends BaseRepository {
  constructor() {
    super(Journey);
  }
  findByServiceAndDate(serviceNumber, journeyDate, options = {}) {
    return this.findOne({ serviceNumber, journeyDate }, options);
  }
  findByTrainAndDeparture(trainId, scheduledDepartureAt, options = {}) {
    return this.findOne({ trainId, scheduledDepartureAt }, options);
  }
  search({ routeId, trainId, dateFrom, dateTo, statuses } = {}, options = {}) {
    const where = {};
    if (routeId) where.routeId = routeId;
    if (trainId) where.trainId = trainId;
    if (dateFrom || dateTo)
      where.journeyDate = {
        ...(dateFrom && { [Op.gte]: dateFrom }),
        ...(dateTo && { [Op.lte]: dateTo }),
      };
    if (statuses?.length) where.status = { [Op.in]: statuses };
    return this.findAll(where, {
      ...options,
      include: options.include || [
        { model: Route, as: 'route' },
        { model: Train, as: 'train' },
      ],
      order: options.order || [['scheduledDepartureAt', 'ASC']],
    });
  }
  findSnapshot(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [
        { model: Route, as: 'route' },
        { model: Train, as: 'train' },
        {
          model: JourneyStation,
          as: 'journeyStations',
          include: [{ model: Station, as: 'station' }],
        },
        {
          model: JourneyCoach,
          as: 'journeyCoaches',
          include: [
            { model: Coach, as: 'coach' },
            { model: JourneySeat, as: 'journeySeats' },
          ],
        },
      ],
      order: [
        [{ model: JourneyStation, as: 'journeyStations' }, 'sequenceNumber', 'ASC'],
        [{ model: JourneyCoach, as: 'journeyCoaches' }, 'positionNumber', 'ASC'],
      ],
    });
  }
  searchPublicJourneys(input, options = {}) {
    return this.model.sequelize.query(
      `SELECT result.*, COUNT(*) OVER()::INTEGER AS "totalCount" FROM (
        SELECT j.id AS "journeyId", j.service_number AS "serviceNumber", j.status,
          j.route_id AS "routeId", r.code AS "routeCode", r.name AS "routeName",
          j.train_id AS "trainId", t.train_number AS "trainNumber", t.name AS "trainName",
          ojs.id AS "originJourneyStationId", ojs.station_id AS "originStationId",
          os.code AS "originCode", os.name AS "originName", ojs.sequence_number AS "originSequence",
          ojs.scheduled_departure_at AS "originDepartureAt",
          djs.id AS "destinationJourneyStationId", djs.station_id AS "destinationStationId",
          ds.code AS "destinationCode", ds.name AS "destinationName", djs.sequence_number AS "destinationSequence",
          djs.scheduled_arrival_at AS "destinationArrivalAt",
          FLOOR(EXTRACT(EPOCH FROM (djs.scheduled_arrival_at - ojs.scheduled_departure_at)) / 60)::INTEGER AS "durationMinutes",
          (SELECT COUNT(*)::INTEGER FROM journey_seats js
            JOIN journey_coaches jc ON jc.id = js.journey_coach_id
            JOIN seats s ON s.id = js.seat_id
            WHERE js.journey_id = j.id AND js.status = 'AVAILABLE' AND jc.is_available = TRUE
              AND jc.reservation_type_snapshot = 'RESERVED' AND s.is_active = TRUE
              AND (:coachClass IS NULL OR jc.coach_class_snapshot = CAST(:coachClass AS coach_class))
              AND NOT EXISTS (SELECT 1 FROM active_seat_allocations asa
                WHERE asa.journey_id = j.id AND asa.seat_id = js.seat_id
                  AND asa.occupied_segment && int4range(ojs.sequence_number, djs.sequence_number, '[)')
                  AND (asa.allocation_type = 'CONFIRMED' OR (asa.allocation_type = 'HELD' AND asa.expires_at > NOW())))) AS "availableSeatCount",
          1 AS "searchMatch"
        FROM journeys j
        JOIN routes r ON r.id = j.route_id
        JOIN trains t ON t.id = j.train_id
        JOIN journey_stations ojs ON ojs.journey_id = j.id AND ojs.station_id = :originStationId
        JOIN stations os ON os.id = ojs.station_id
        JOIN journey_stations djs ON djs.journey_id = j.id AND djs.station_id = :destinationStationId
        JOIN stations ds ON ds.id = djs.station_id
        WHERE j.journey_date = :date AND j.status IN ('SCHEDULED', 'DELAYED', 'BOARDING')
          AND ojs.sequence_number < djs.sequence_number AND ojs.can_board = TRUE AND djs.can_alight = TRUE
          AND ojs.scheduled_departure_at > NOW()
          AND (j.booking_opens_at IS NULL OR j.booking_opens_at <= NOW())
          AND (j.booking_closes_at IS NULL OR j.booking_closes_at > NOW())
      ) result
      WHERE result."availableSeatCount" >= :passengerCount
      ORDER BY result."originDepartureAt" ASC LIMIT :limit OFFSET :offset`,
      { ...options, replacements: input, type: QueryTypes.SELECT }
    );
  }
  searchUpcomingJourneys(input, options = {}) {
    const sortColumn =
      input.sortBy === 'duration'
        ? 'durationMinutes'
        : input.sortBy === 'availability'
          ? 'availableSeatCount'
          : 'originDepartureAt';
    const sortDirection = String(input.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const replacements = {
      timeZone: railwayTimeZone.timeZone,
      originStationId: input.originStationId,
      destinationStationId: input.destinationStationId,
      dateFrom: input.dateFrom || null,
      dateTo: input.dateTo || null,
      coachClass: input.coachClass || null,
      passengerCount: input.passengerCount || 1,
      limit: input.limit || 20,
      offset: input.offset || 0,
      sortColumn,
      sortDirection,
    };
    return this.model.sequelize.query(
      `SELECT result.*, COUNT(*) OVER()::INTEGER AS "totalCount" FROM (
        SELECT j.id AS "journeyId", j.service_number AS "serviceNumber", j.status,
          j.route_id AS "routeId", r.code AS "routeCode", r.name AS "routeName",
          j.train_id AS "trainId", t.train_number AS "trainNumber", t.name AS "trainName",
          ojs.id AS "originJourneyStationId", ojs.station_id AS "originStationId",
          os.code AS "originCode", os.name AS "originName", ojs.sequence_number AS "originSequence",
          ojs.scheduled_departure_at AS "originDepartureAt",
          djs.id AS "destinationJourneyStationId", djs.station_id AS "destinationStationId",
          ds.code AS "destinationCode", ds.name AS "destinationName", djs.sequence_number AS "destinationSequence",
          djs.scheduled_arrival_at AS "destinationArrivalAt",
          FLOOR(EXTRACT(EPOCH FROM (djs.scheduled_arrival_at - ojs.scheduled_departure_at)) / 60)::INTEGER AS "durationMinutes",
          (SELECT COUNT(*)::INTEGER FROM journey_seats js
            JOIN journey_coaches jc ON jc.id = js.journey_coach_id
            JOIN seats s ON s.id = js.seat_id
            WHERE js.journey_id = j.id AND js.status = 'AVAILABLE' AND jc.is_available = TRUE
              AND jc.reservation_type_snapshot = 'RESERVED' AND s.is_active = TRUE
              AND (:coachClass IS NULL OR jc.coach_class_snapshot = CAST(:coachClass AS coach_class))
              AND NOT EXISTS (SELECT 1 FROM active_seat_allocations asa
                WHERE asa.journey_id = j.id AND asa.seat_id = js.seat_id
                  AND asa.occupied_segment && int4range(
                    ojs.sequence_number,
                    djs.sequence_number,
                    '[)'
                  )
                  AND (asa.allocation_type = 'CONFIRMED' OR (asa.allocation_type = 'HELD' AND asa.expires_at > NOW())))) AS "availableSeatCount"
        FROM journeys j
        JOIN routes r ON r.id = j.route_id
        JOIN trains t ON t.id = j.train_id
        JOIN LATERAL (
          SELECT js.*, s.code, s.name
          FROM journey_stations js
          JOIN stations s ON s.id = js.station_id
          WHERE js.journey_id = j.id AND (:originStationId IS NULL OR js.station_id = :originStationId)
          ORDER BY js.sequence_number ASC
          LIMIT 1
        ) ojs ON TRUE
        JOIN stations os ON os.id = ojs.station_id
        JOIN LATERAL (
          SELECT js.*, s.code, s.name
          FROM journey_stations js
          JOIN stations s ON s.id = js.station_id
          WHERE js.journey_id = j.id AND (:destinationStationId IS NULL OR js.station_id = :destinationStationId)
          ORDER BY js.sequence_number DESC
          LIMIT 1
        ) djs ON TRUE
        JOIN stations ds ON ds.id = djs.station_id
        WHERE j.journey_date >= COALESCE(:dateFrom::date, timezone(:timeZone, NOW())::date)
          AND (:dateTo IS NULL OR j.journey_date <= :dateTo::date)
          AND j.status IN ('SCHEDULED', 'DELAYED', 'BOARDING')
          AND (j.booking_opens_at IS NULL OR j.booking_opens_at <= NOW())
          AND (j.booking_closes_at IS NULL OR j.booking_closes_at > NOW())
          AND ojs.sequence_number < djs.sequence_number
          AND ojs.can_board = TRUE
          AND djs.can_alight = TRUE
      ) result
      WHERE result."availableSeatCount" >= :passengerCount
      ORDER BY result."${sortColumn}" ${sortDirection}, result."journeyId" ASC
      LIMIT :limit OFFSET :offset`,
      { ...options, replacements, type: QueryTypes.SELECT }
    ).then((rows) => rows.map((row) => ({ ...row, availableSeatCount: Number(row.availableSeatCount) })));
  }
  countSearchResults(input, options = {}) {
    return this.searchPublicJourneys(input, options).then((rows) =>
      Number(rows[0]?.totalCount || 0)
    );
  }
  findJourneyWithSegment(input, options = {}) {
    return this.searchPublicJourneys(
      {
        ...input,
        limit: 1,
        offset: 0,
        passengerCount: input.passengerCount || 1,
        coachClass: input.coachClass || null,
      },
      options
    ).then((rows) => rows[0] || null);
  }
  findByIdWithDetails(id, options = {}) {
    return this.findSnapshot(id, options);
  }
}
module.exports = JourneyRepository;
