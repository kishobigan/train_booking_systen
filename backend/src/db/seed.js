require('dotenv').config();
const crypto = require('crypto');
const pool = require('../config/db');
const logger = require('../config/logger');

const STATIONS = [
  { code: 'FOT', name: 'Colombo Fort', city: 'Colombo', distance: 0 },
  { code: 'GPH', name: 'Gampaha', city: 'Gampaha', distance: 27 },
  { code: 'VYD', name: 'Veyangoda', city: 'Gampaha', distance: 40 },
  { code: 'PLG', name: 'Polgahawela', city: 'Kurunegala', distance: 74 },
  { code: 'RBK', name: 'Rambukkana', city: 'Kegalle', distance: 95 },
  { code: 'PDJ', name: 'Peradeniya Junction', city: 'Kandy', distance: 115 },
  { code: 'KDT', name: 'Kandy', city: 'Kandy', distance: 120 },
  { code: 'HTN', name: 'Hatton', city: 'Nuwara Eliya', distance: 165 },
  { code: 'NOA', name: 'Nanu Oya', city: 'Nuwara Eliya', distance: 207 },
  { code: 'HPL', name: 'Haputale', city: 'Badulla', distance: 240 },
  { code: 'BDW', name: 'Bandarawela', city: 'Badulla', distance: 255 },
  { code: 'ELL', name: 'Ella', city: 'Badulla', distance: 271 },
  { code: 'BAD', name: 'Badulla', city: 'Badulla', distance: 292 },
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function generateSeats(coachId, totalSeats, layout) {
  const seats = [];
  const { rows, columns } = layout;
  let count = 0;

  for (let row = 1; row <= rows && count < totalSeats; row++) {
    for (let col = 1; col <= columns && count < totalSeats; col++) {
      seats.push({
        coachId,
        seatNumber: `${row}${String.fromCharCode(64 + col)}`,
        rowNumber: row,
        columnNumber: col,
        isWindow: col === 1 || col === columns,
        isAisle: col === 2 || col === 3,
      });
      count++;
    }
  }

  return seats;
}

async function seed() {
  const client = await pool.connect();

  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM stations');
    if (rows[0].count > 0) {
      logger.info('Seed data already exists; skipping');
      return;
    }

    await client.query('BEGIN');

    // ── Stations ──────────────────────────────────────────────────────────
    const stationIds = {};
    for (const s of STATIONS) {
      const result = await client.query(
        `INSERT INTO stations (code, name, city, is_active)
         VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [s.code, s.name, s.city]
      );
      stationIds[s.code] = result.rows[0].id;
    }

    // ── Routes ────────────────────────────────────────────────────────────
    const cmbBad = await client.query(
      `INSERT INTO routes (code, name, start_station_id, end_station_id, total_distance_km, is_active)
       VALUES ('CMB-BAD', 'Colombo Fort to Badulla', $1, $2, 292.00, TRUE)
       RETURNING id`,
      [stationIds.FOT, stationIds.BAD]
    );
    const routeCmbBadId = cmbBad.rows[0].id;

    const badCmb = await client.query(
      `INSERT INTO routes (code, name, start_station_id, end_station_id, total_distance_km, is_active)
       VALUES ('BAD-CMB', 'Badulla to Colombo Fort', $1, $2, 292.00, TRUE)
       RETURNING id`,
      [stationIds.BAD, stationIds.FOT]
    );
    const routeBadCmbId = badCmb.rows[0].id;

    // ── Route stations (forward) ──────────────────────────────────────────
    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      await client.query(
        `INSERT INTO route_stations
           (route_id, station_id, sequence_number, distance_from_start_km, can_board, can_alight)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
        [routeCmbBadId, stationIds[s.code], i, s.distance]
      );
    }

    // ── Route stations (reverse) ──────────────────────────────────────────
    const reversed = [...STATIONS].reverse();
    for (let i = 0; i < reversed.length; i++) {
      const s = reversed[i];
      await client.query(
        `INSERT INTO route_stations
           (route_id, station_id, sequence_number, distance_from_start_km, can_board, can_alight)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
        [routeBadCmbId, stationIds[s.code], i, STATIONS.find((x) => x.code === s.code).distance]
      );
    }

    // ── Train ─────────────────────────────────────────────────────────────
    const trainResult = await client.query(
      `INSERT INTO trains (train_number, name, description, is_active)
       VALUES ('1005', 'Podi Menike', 'Scenic hill-country service', TRUE)
       RETURNING id`
    );
    const trainId = trainResult.rows[0].id;

    // ── Coaches ───────────────────────────────────────────────────────────
    const coachDefs = [
      {
        number: 'R1',
        cls: 'SECOND_CLASS',
        type: 'RESERVED',
        pos: 1,
        seats: 48,
        layout: { rows: 12, columns: 4 },
      },
      {
        number: 'R2',
        cls: 'SECOND_CLASS',
        type: 'RESERVED',
        pos: 2,
        seats: 48,
        layout: { rows: 12, columns: 4 },
      },
      {
        number: 'R3',
        cls: 'OBSERVATION_CLASS',
        type: 'RESERVED',
        pos: 3,
        seats: 36,
        layout: { rows: 9, columns: 4 },
      },
      { number: 'U1', cls: 'SECOND_CLASS', type: 'UNRESERVED', pos: 4, seats: 0, layout: null },
      { number: 'U2', cls: 'SECOND_CLASS', type: 'UNRESERVED', pos: 5, seats: 0, layout: null },
      { number: 'U3', cls: 'THIRD_CLASS', type: 'UNRESERVED', pos: 6, seats: 0, layout: null },
      { number: 'U4', cls: 'THIRD_CLASS', type: 'UNRESERVED', pos: 7, seats: 0, layout: null },
      { number: 'U5', cls: 'THIRD_CLASS', type: 'UNRESERVED', pos: 8, seats: 0, layout: null },
    ];

    for (const c of coachDefs) {
      const coachResult = await client.query(
        `INSERT INTO coaches
           (train_id, coach_number, coach_class, reservation_type, position_number, total_seats, seat_layout, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         RETURNING id`,
        [
          trainId,
          c.number,
          c.cls,
          c.type,
          c.pos,
          c.seats,
          c.layout ? JSON.stringify(c.layout) : null,
        ]
      );

      if (c.seats > 0 && c.layout) {
        const seatRows = generateSeats(coachResult.rows[0].id, c.seats, c.layout);
        for (const seat of seatRows) {
          await client.query(
            `INSERT INTO seats
               (coach_id, seat_number, row_number, column_number, is_window, is_aisle, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
            [
              seat.coachId,
              seat.seatNumber,
              seat.rowNumber,
              seat.columnNumber,
              seat.isWindow,
              seat.isAisle,
            ]
          );
        }
      }
    }

    // ── Fare rules ────────────────────────────────────────────────────────
    const fareRule = await client.query(
      `INSERT INTO fare_rules
         (route_id, name, base_fare, price_per_km, minimum_fare, currency, valid_from, is_active)
       VALUES ($1, 'Colombo-Badulla Standard', 100.00, 5.50, 200.00, 'LKR', CURRENT_DATE, TRUE)
       RETURNING id`,
      [routeCmbBadId]
    );

    await client.query(
      `INSERT INTO fare_rule_classes (fare_rule_id, coach_class, price_per_km_override, multiplier)
       VALUES
         ($1, 'SECOND_CLASS', 5.50, 1.000),
         ($1, 'OBSERVATION_CLASS', 8.00, 1.000),
         ($1, 'THIRD_CLASS', 4.00, 1.000)`,
      [fareRule.rows[0].id]
    );

    // ── Passenger fare discounts ──────────────────────────────────────────
    await client.query(`
      INSERT INTO passenger_fare_rules (passenger_type, discount_percentage, is_active)
      VALUES
        ('ADULT', 0, TRUE),
        ('CHILD', 50, TRUE),
        ('SENIOR', 25, TRUE),
        ('STUDENT', 15, TRUE),
        ('DISABLED', 25, TRUE)
    `);

    // ── Admin user (dev only — from env) ──────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@trainbooking.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active, email_verified_at)
       VALUES ('System Admin', $1, $2, 'SUPER_ADMIN', TRUE, NOW())`,
      [adminEmail, hashPassword(adminPassword)]
    );

    // ── Sample journey (tomorrow) ─────────────────────────────────────────
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const journeyDate = tomorrow.toISOString().split('T')[0];
    const departureAt = new Date(tomorrow);
    departureAt.setHours(5, 55, 0, 0);
    const arrivalAt = new Date(tomorrow);
    arrivalAt.setHours(16, 0, 0, 0);

    const journeyResult = await client.query(
      `INSERT INTO journeys
         (route_id, train_id, service_number, journey_date,
          scheduled_departure_at, scheduled_arrival_at, status,
          booking_opens_at, booking_closes_at)
       VALUES ($1, $2, '1005', $3, $4, $5, 'SCHEDULED', NOW(), $4)
       RETURNING id`,
      [routeCmbBadId, trainId, journeyDate, departureAt.toISOString(), arrivalAt.toISOString()]
    );
    const journeyId = journeyResult.rows[0].id;

    // Journey station snapshots
    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      const offsetMinutes = i * 55;
      const stationTime = new Date(departureAt.getTime() + offsetMinutes * 60000);

      await client.query(
        `INSERT INTO journey_stations
           (journey_id, station_id, sequence_number, distance_from_start_km,
            scheduled_arrival_at, scheduled_departure_at, can_board, can_alight)
         VALUES ($1, $2, $3, $4, $5, $5, TRUE, TRUE)`,
        [journeyId, stationIds[s.code], i, s.distance, stationTime.toISOString()]
      );
    }

    // Journey coach & seat snapshots
    const { rows: coaches } = await client.query(
      'SELECT * FROM coaches WHERE train_id = $1 ORDER BY position_number',
      [trainId]
    );

    for (const coach of coaches) {
      const jcResult = await client.query(
        `INSERT INTO journey_coaches
           (journey_id, coach_id, coach_number_snapshot, coach_class_snapshot,
            reservation_type_snapshot, position_number, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id`,
        [
          journeyId,
          coach.id,
          coach.coach_number,
          coach.coach_class,
          coach.reservation_type,
          coach.position_number,
        ]
      );

      const { rows: coachSeats } = await client.query(
        'SELECT * FROM seats WHERE coach_id = $1 AND is_active = TRUE',
        [coach.id]
      );

      for (const seat of coachSeats) {
        await client.query(
          `INSERT INTO journey_seats
             (journey_id, journey_coach_id, seat_id, seat_number_snapshot, status)
           VALUES ($1, $2, $3, $4, 'AVAILABLE')`,
          [journeyId, jcResult.rows[0].id, seat.id, seat.seat_number]
        );
      }
    }

    await client.query('COMMIT');
    logger.info({ adminEmail }, 'Seed data inserted successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
