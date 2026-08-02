'use strict';

const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../../database/sequelize');
const models = require('../../models');
const logger = require('../../config/logger');
const passwordService = require('../../lib/password');
const { coaches: coachData, stations: stationData, canonicalDistanceKm } = require('./data');
const { loadSeedConfig } = require('./config');
const {
  assertSeedData,
  buildTimetable,
  dateInTimeZone,
  generateSeats,
  normalizeName,
  roundDistance,
  zonedDateTime,
} = require('./helpers');

const ROUTE_CODE = 'CMB-BAD-MAIN';
const TRAIN_NUMBER = '1005';
const SERVICE_NUMBER = 'SEED-1005';
const FARE_NAME = 'Seed Main Line Standard Fare';

async function updateOrCreate(Model, where, values, transaction) {
  const existing = await Model.findOne({ where, transaction });
  if (existing) return existing.update(values, { transaction });
  return Model.create({ ...where, ...values }, { transaction });
}

async function seedUsers(config, transaction) {
  const result = {};
  for (const definition of config.users) {
    const User = models.User.unscoped();
    let user = await User.findOne({
      where: { email: definition.email },
      paranoid: false,
      transaction,
    });
    const values = {
      fullName: definition.fullName,
      email: definition.email,
      phoneNumber: definition.phoneNumber,
      role: definition.role,
      isActive: true,
      mustChangePassword: config.mustChangePassword,
      emailVerifiedAt: sequelize.fn('NOW'),
    };
    if (!user || config.resetPasswords || !user.passwordHash)
      values.passwordHash = await passwordService.hash(definition.password);
    if (user) {
      if (user.deletedAt) await user.restore({ transaction });
      user = await user.update(values, { transaction });
    } else user = await User.create(values, { transaction });
    result[definition.role] = user;
  }
  return result;
}

async function seedStations(transaction) {
  const existing = await models.Station.findAll({ transaction });
  const byCode = new Map(existing.map((station) => [station.code.toUpperCase(), station]));
  const byName = new Map(existing.map((station) => [normalizeName(station.name), station]));
  const seeded = [];
  for (const definition of stationData) {
    let station = byCode.get(definition.code) || byName.get(normalizeName(definition.name));
    if (station)
      station = await station.update({ name: definition.name, isActive: true }, { transaction });
    else
      station = await models.Station.create(
        { code: definition.code, name: definition.name, isActive: true },
        { transaction }
      );
    seeded.push({ ...definition, model: station });
  }
  if (new Set(seeded.map(({ model }) => model.id)).size !== stationData.length)
    throw new Error('Station matching produced duplicate route stations');
  return seeded;
}

async function seedRoute(stations, timetable, transaction) {
  const route = await updateOrCreate(
    models.Route,
    { code: ROUTE_CODE },
    {
      name: 'Colombo Fort to Badulla Main Line',
      description: 'Development seed route for the direct Colombo Fort–Badulla main line.',
      startStationId: stations[0].model.id,
      endStationId: stations.at(-1).model.id,
      totalDistanceKm: roundDistance(canonicalDistanceKm),
      isActive: true,
    },
    transaction
  );
  for (const stop of timetable) {
    await updateOrCreate(
      models.RouteStation,
      { routeId: route.id, stationId: stations[stop.sequenceNumber].model.id },
      {
        sequenceNumber: stop.sequenceNumber,
        distanceFromStartKm: roundDistance(stop.distanceKm),
        defaultArrivalOffsetMinutes: stop.arrivalOffsetMinutes,
        defaultDepartureOffsetMinutes: stop.departureOffsetMinutes,
        stopDurationMinutes: stop.stopDurationMinutes,
        canBoard: stop.sequenceNumber !== stationData.length - 1,
        canAlight: stop.sequenceNumber !== 0,
      },
      transaction
    );
  }
  return route;
}

async function seedTrain(transaction) {
  const train = await updateOrCreate(
    models.Train,
    { trainNumber: TRAIN_NUMBER },
    {
      name: 'Seed Main Line Express',
      description: 'Development seed express service.',
      isActive: true,
    },
    transaction
  );
  const coaches = [];
  for (const definition of coachData) {
    const coach = await updateOrCreate(
      models.Coach,
      { trainId: train.id, coachNumber: definition.coachNumber },
      {
        coachClass: definition.coachClass,
        reservationType: definition.reservationType,
        positionNumber: definition.positionNumber,
        totalSeats: definition.totalSeats,
        seatLayout: definition.rows ? { rows: definition.rows, columns: definition.columns } : null,
        isActive: true,
      },
      transaction
    );
    const desiredSeats = generateSeats(definition);
    for (const seat of desiredSeats)
      await updateOrCreate(
        models.Seat,
        { coachId: coach.id, seatNumber: seat.seatNumber },
        seat,
        transaction
      );
    await models.Seat.update(
      { isActive: false },
      {
        where: {
          coachId: coach.id,
          ...(desiredSeats.length
            ? { seatNumber: { [Op.notIn]: desiredSeats.map((seat) => seat.seatNumber) } }
            : {}),
        },
        transaction,
      }
    );
    coaches.push({ definition, model: coach });
  }
  return { train, coaches };
}

async function seedJourney({
  route,
  train,
  coaches,
  stations,
  timetable,
  config,
  databaseNow,
  transaction,
}) {
  const localToday = dateInTimeZone(databaseNow, config.timeZone, 0);
  let journey = await models.Journey.findOne({
    where: { serviceNumber: SERVICE_NUMBER, journeyDate: { [Op.gte]: localToday } },
    order: [['journeyDate', 'ASC']],
    transaction,
  });
  if (!journey) {
    const journeyDate = dateInTimeZone(databaseNow, config.timeZone, 7);
    const departure = zonedDateTime(journeyDate, '05:55', config.timeZone);
    const finalOffset = timetable.at(-1).arrivalOffsetMinutes;
    journey = await models.Journey.create(
      {
        routeId: route.id,
        trainId: train.id,
        serviceNumber: SERVICE_NUMBER,
        journeyDate,
        scheduledDepartureAt: departure,
        scheduledArrivalAt: new Date(departure.getTime() + finalOffset * 60000),
        status: 'SCHEDULED',
        bookingOpensAt: databaseNow,
        bookingClosesAt: new Date(departure.getTime() - 30 * 60000),
      },
      { transaction }
    );
  }
  const departure = new Date(journey.scheduledDepartureAt);
  for (const stop of timetable) {
    await updateOrCreate(
      models.JourneyStation,
      { journeyId: journey.id, stationId: stations[stop.sequenceNumber].model.id },
      {
        sequenceNumber: stop.sequenceNumber,
        distanceFromStartKm: roundDistance(stop.distanceKm),
        scheduledArrivalAt:
          stop.arrivalOffsetMinutes === null
            ? null
            : new Date(departure.getTime() + stop.arrivalOffsetMinutes * 60000),
        scheduledDepartureAt:
          stop.departureOffsetMinutes === null
            ? null
            : new Date(departure.getTime() + stop.departureOffsetMinutes * 60000),
        canBoard: stop.sequenceNumber !== stationData.length - 1,
        canAlight: stop.sequenceNumber !== 0,
      },
      transaction
    );
  }
  for (const coach of coaches) {
    const journeyCoach = await updateOrCreate(
      models.JourneyCoach,
      { journeyId: journey.id, coachId: coach.model.id },
      {
        coachNumberSnapshot: coach.model.coachNumber,
        coachClassSnapshot: coach.model.coachClass,
        reservationTypeSnapshot: coach.model.reservationType,
        positionNumber: coach.model.positionNumber,
        isAvailable: true,
      },
      transaction
    );
    const seats = await models.Seat.findAll({
      where: { coachId: coach.model.id, isActive: true },
      transaction,
    });
    for (const seat of seats)
      await updateOrCreate(
        models.JourneySeat,
        { journeyId: journey.id, seatId: seat.id },
        {
          journeyCoachId: journeyCoach.id,
          seatNumberSnapshot: seat.seatNumber,
          status: 'AVAILABLE',
          blockedReason: null,
        },
        transaction
      );
  }
  return journey;
}

async function seedAssignments({ users, journey, stations, config, databaseNow, transaction }) {
  await updateOrCreate(
    models.AdminJourney,
    { adminUserId: users.ADMIN.id, journeyId: journey.id },
    {
      assignedByUserId: users.SUPER_ADMIN.id,
      assignedAt: databaseNow,
      isActive: true,
    },
    transaction
  );
  const byCode = new Map(
    stations.map((station) => [station.model.code.toUpperCase(), station.model])
  );
  for (const code of config.staffStationCodes) {
    const station = byCode.get(code) || stations.find((item) => item.code === code)?.model;
    if (!station)
      throw new Error(`SEED_STAFF_STATION_CODES contains an unknown seeded station: ${code}`);
    await updateOrCreate(
      models.StaffStation,
      { staffUserId: users.STAFF.id, stationId: station.id },
      {
        assignedByUserId: users.ADMIN.id,
        assignedAt: databaseNow,
        isActive: true,
      },
      transaction
    );
  }
}

async function seedFares(route, journeyDate, transaction) {
  const fare = await updateOrCreate(
    models.FareRule,
    { routeId: route.id, name: FARE_NAME },
    {
      baseFare: '100.00',
      pricePerKm: '5.5000',
      minimumFare: '200.00',
      currency: 'LKR',
      validFrom: journeyDate,
      validUntil: null,
      priority: 100,
      isActive: true,
    },
    transaction
  );
  for (const [coachClass, multiplier] of [
    ['FIRST_CLASS', '2.000'],
    ['SECOND_CLASS', '1.000'],
    ['THIRD_CLASS', '0.750'],
  ]) {
    await updateOrCreate(
      models.FareRuleClass,
      { fareRuleId: fare.id, coachClass },
      { multiplier },
      transaction
    );
  }
  for (const [passengerType, discountPercentage] of [
    ['ADULT', '0.00'],
    ['CHILD', '50.00'],
  ]) {
    await updateOrCreate(
      models.PassengerFareRule,
      { passengerType },
      { discountPercentage, isActive: true },
      transaction
    );
  }
  return fare;
}

async function verify({ users, route, train, journey, fare, config, transaction }) {
  const routeStops = await models.RouteStation.findAll({
    where: { routeId: route.id },
    order: [['sequenceNumber', 'ASC']],
    transaction,
  });
  const checks = {
    users: new Set(Object.values(users).map((user) => user.id)).size === 3,
    routeStations: routeStops.length === 79,
    routeSequence: routeStops.every((stop, index) => stop.sequenceNumber === index),
    routeDistanceOrder: routeStops.every(
      (stop, index) =>
        index === 0 ||
        Number(stop.distanceFromStartKm) > Number(routeStops[index - 1].distanceFromStartKm)
    ),
    routeEndpoints:
      route.startStationId === routeStops[0]?.stationId &&
      route.endStationId === routeStops.at(-1)?.stationId,
    routeDistance: Number(route.totalDistanceKm) === roundDistance(canonicalDistanceKm),
    coaches: (await models.Coach.count({ where: { trainId: train.id }, transaction })) === 8,
    reservedCoaches:
      (await models.Coach.count({
        where: { trainId: train.id, reservationType: 'RESERVED' },
        transaction,
      })) === 3,
    unreservedCoaches:
      (await models.Coach.count({
        where: { trainId: train.id, reservationType: 'UNRESERVED' },
        transaction,
      })) === 5,
    seats:
      (await models.Seat.count({
        include: [
          {
            model: models.Coach,
            as: 'coach',
            required: true,
            where: { trainId: train.id, reservationType: 'RESERVED' },
          },
        ],
        where: { isActive: true },
        transaction,
      })) === 120,
    journeyStations:
      (await models.JourneyStation.count({ where: { journeyId: journey.id }, transaction })) === 79,
    journeyCoaches:
      (await models.JourneyCoach.count({ where: { journeyId: journey.id }, transaction })) === 8,
    journeySeats:
      (await models.JourneySeat.count({ where: { journeyId: journey.id }, transaction })) === 120,
    adminAssignment:
      (await models.AdminJourney.count({
        where: { adminUserId: users.ADMIN.id, journeyId: journey.id, isActive: true },
        transaction,
      })) === 1,
    staffAssignments:
      (await models.StaffStation.count({
        where: { staffUserId: users.STAFF.id, isActive: true },
        transaction,
      })) >= config.staffStationCodes.length,
    fare: Boolean(fare?.id),
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failed.length) throw new Error(`Seed verification failed: ${failed.join(', ')}`);
  return checks;
}

async function runSeed(options = {}) {
  const config = loadSeedConfig();
  assertSeedData(stationData, coachData);
  logger.info('[seed] Checking environment');
  const result = await sequelize.transaction(async (transaction) => {
    const [{ now: databaseNow }] = await sequelize.query('SELECT NOW() AS now', {
      type: QueryTypes.SELECT,
      transaction,
    });
    logger.info('[seed] Creating users');
    const users = await seedUsers(config, transaction);
    logger.info('[seed] Creating railway network');
    const stations = await seedStations(transaction);
    const timetable = buildTimetable(stationData);
    const route = await seedRoute(stations, timetable, transaction);
    logger.info('[seed] Creating train and seats');
    const { train, coaches } = await seedTrain(transaction);
    logger.info('[seed] Creating journey snapshots');
    const journey = await seedJourney({
      route,
      train,
      coaches,
      stations,
      timetable,
      config,
      databaseNow: new Date(databaseNow),
      transaction,
    });
    logger.info('[seed] Creating assignments and development fares');
    await seedAssignments({
      users,
      journey,
      stations,
      config,
      databaseNow: new Date(databaseNow),
      transaction,
    });
    const fare = await seedFares(route, journey.journeyDate, transaction);
    await options.beforeVerify?.({ transaction, users, stations, route, train, journey, fare });
    const checks = await verify({ users, route, train, journey, fare, config, transaction });
    return { users, route, train, journey, checks };
  });
  return result;
}

function printSummary(result) {
  const { users, journey } = result;
  // The CLI summary is intentionally human-readable rather than structured JSON logging.
  // eslint-disable-next-line no-console
  console.log(
    `Seed completed successfully\n\nUsers\n- Super Admin: ${users.SUPER_ADMIN.email}\n- Admin: ${users.ADMIN.email}\n- Staff: ${users.STAFF.email}\n\nRoute\n- ${ROUTE_CODE}\n- Colombo Fort → Badulla\n- 79 stations\n- ${canonicalDistanceKm.toFixed(3)} km (stored as ${roundDistance(canonicalDistanceKm).toFixed(2)} km)\n\nTrain\n- Seed Main Line Express\n- 8 coaches\n- 3 reserved coaches\n- 5 unreserved coaches\n- 120 reserved seats\n\nJourney\n- Service: ${SERVICE_NUMBER}\n- Date: ${journey.journeyDate}\n- Colombo Fort → Badulla\n\nAssignments\n- Admin assigned to seeded journey\n- Staff assigned to configured seeded stations\n\nPasswords are not displayed; use your configured environment values.`
  );
}

module.exports = { runSeed, printSummary, verify };
