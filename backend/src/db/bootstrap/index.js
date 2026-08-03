'use strict';

const logger = require('../../config/logger');
const BootstrapState = require('./bootstrap.state');
const { BootstrapClient } = require('./bootstrap.client');
const { loadBootstrapConfig } = require('./bootstrap.config');
const { stations: stationData, coaches: coachData, canonicalDistanceKm } = require('../seeds/data');
const { assertSeedData, buildTimetable, dateInTimeZone, zonedDateTime, roundDistance } = require('../seeds/helpers');

const ROUTE_CODE = 'CMB-BAD-MAIN';
const REVERSE_ROUTE_CODE = `${ROUTE_CODE}-REV`;
const TRAIN_NUMBER = '1005';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const rows = (value) => value?.rows || value?.items || value || [];

async function waitForApi(client) {
  let lastError;
  for (let attempt = 1; attempt <= client.config.retryAttempts; attempt += 1) {
    try {
      return await client.request('/health', { authenticated: false });
    } catch (error) {
      lastError = error;
      if (attempt < client.config.retryAttempts) await sleep(client.config.retryDelayMs);
    }
  }
  throw lastError;
}

async function provisionUser(client, definition) {
  const existing = rows(await client.get(`/super-admin/users?search=${encodeURIComponent(definition.email)}&pageSize=100`))
    .find((user) => user.email.toLowerCase() === definition.email);
  if (existing) {
    if (existing.role !== definition.role || !existing.isActive) throw new Error(`Existing ${definition.email} has an invalid role or state`);
    return existing;
  }
  const created = await client.post('/super-admin/users', {
    fullName: definition.fullName,
    email: definition.email,
    phoneNumber: definition.phoneNumber,
    role: definition.role,
    journeyIds: [],
    stationIds: [],
  }, `bootstrap:user:${definition.role.toLowerCase()}`);
  const temporaryPassword = created.temporaryCredential?.temporaryPassword;
  if (!temporaryPassword) throw new Error(`User API did not return a temporary credential for ${definition.role}`);
  const isolatedState = new BootstrapState();
  const isolated = new BootstrapClient(client.config, isolatedState);
  const login = await isolated.request('/auth/login', { method: 'POST', authenticated: false, body: { identifier: definition.email, password: temporaryPassword } });
  if (!login.requiresPasswordChange || !login.passwordChangeToken) throw new Error(`Initial password flow was not returned for ${definition.role}`);
  await isolated.request('/auth/change-initial-password', {
    method: 'POST',
    authenticated: false,
    body: { currentPassword: temporaryPassword, newPassword: definition.password, confirmPassword: definition.password },
    idempotencyKey: `bootstrap:password:${definition.role.toLowerCase()}`,
    headers: { authorization: `Bearer ${login.passwordChangeToken}` },
  });
  return created.user;
}

async function provisionStations(client) {
  const existing = rows(await client.get('/super-admin/manage/stations?limit=100'));
  const byCode = new Map(existing.map((station) => [station.code, station]));
  const result = [];
  for (const definition of stationData) {
    let station = byCode.get(definition.code);
    if (!station) station = await client.post('/super-admin/manage/stations', { code: definition.code, name: definition.name, isActive: true }, `bootstrap:station:${definition.code}`);
    else if (station.name !== definition.name || !station.isActive) station = await client.patch(`/super-admin/manage/stations/${station.id}`, { name: definition.name, isActive: true });
    result.push({ ...definition, id: station.id });
  }
  return result;
}

function routeStations(stations, timetable) {
  return timetable.map((stop) => ({
    stationId: stations[stop.sequenceNumber].id,
    sequenceNumber: stop.sequenceNumber,
    distanceFromStartKm: roundDistance(stop.distanceKm),
    defaultArrivalOffsetMinutes: stop.arrivalOffsetMinutes,
    defaultDepartureOffsetMinutes: stop.departureOffsetMinutes,
    stopDurationMinutes: stop.stopDurationMinutes,
    canBoard: stop.sequenceNumber !== stations.length - 1,
    canAlight: stop.sequenceNumber !== 0,
  }));
}

async function provisionRoutes(client, stations, timetable) {
  const existing = rows(await client.get('/routes?limit=100'));
  let outbound = existing.find((route) => route.code === ROUTE_CODE);
  if (!outbound) outbound = await client.post('/super-admin/routes', {
    code: ROUTE_CODE, name: 'Colombo Fort to Badulla Main Line',
    description: 'Interview demonstration route for the Colombo Fort–Badulla main line.',
    startStationId: stations[0].id, endStationId: stations.at(-1).id,
    totalDistanceKm: roundDistance(canonicalDistanceKm), isActive: true,
    stations: routeStations(stations, timetable),
  }, 'bootstrap:route:cmb-bad-main');
  let reverse = existing.find((route) => route.code === REVERSE_ROUTE_CODE);
  if (!reverse) reverse = await client.post(`/super-admin/routes/${outbound.id}/clone-reverse`, {
    code: REVERSE_ROUTE_CODE, name: 'Badulla to Colombo Fort Main Line',
    description: 'Direction-correct reverse snapshot source for interview journeys.',
  }, 'bootstrap:route:bad-cmb-main');
  return { outbound, reverse };
}

async function provisionTrain(client) {
  const existing = rows(await client.get('/super-admin/manage/trains?limit=100'));
  let train = existing.find((item) => item.trainNumber === TRAIN_NUMBER);
  if (!train) train = await client.post('/super-admin/manage/trains', { trainNumber: TRAIN_NUMBER, name: 'Main Line Interview Express', description: 'Configurable eight-coach demonstration train.', isActive: true }, `bootstrap:train:${TRAIN_NUMBER}`);
  let configuration = await client.get(`/super-admin/manage/trains/${train.id}`);
  for (const definition of coachData) {
    let coach = configuration.coaches?.find((item) => item.coachNumber === definition.coachNumber);
    if (!coach) coach = await client.post(`/super-admin/manage/trains/${train.id}/coaches`, {
      coachNumber: definition.coachNumber, coachClass: definition.coachClass,
      reservationType: definition.reservationType, positionNumber: definition.positionNumber,
      totalSeats: definition.totalSeats, seatLayout: definition.rows ? { rows: definition.rows, columns: definition.columns } : null, isActive: true,
    }, `bootstrap:coach:${TRAIN_NUMBER}:${definition.coachNumber}`);
    if (definition.reservationType === 'RESERVED') {
      const current = configuration.coaches?.find((item) => item.id === coach.id);
      if (!current?.seats?.length) await client.post(`/super-admin/manage/coaches/${coach.id}/seats/generate`, { rows: definition.rows, columns: definition.columns, totalSeats: definition.totalSeats }, `bootstrap:seats:${TRAIN_NUMBER}:${definition.coachNumber}`);
    }
  }
  configuration = await client.get(`/super-admin/manage/trains/${train.id}`);
  return configuration;
}

async function provisionJourneys(client, config, routes, train, timetable) {
  const today = dateInTimeZone(new Date(), config.timeZone, 0);
  const existing = rows(await client.get(`/super-admin/manage/journeys?dateFrom=${today}`));
  const definitions = [
    { serviceNumber: 'DEMO-1005-A', days: 7, time: '05:55', route: routes.outbound },
    { serviceNumber: 'DEMO-1005-B', days: 14, time: '08:30', route: routes.outbound },
    { serviceNumber: 'DEMO-1006-R', days: 10, time: '05:45', route: routes.reverse },
  ];
  const journeys = [];
  for (const definition of definitions) {
    let journey = existing.find((item) => item.serviceNumber === definition.serviceNumber);
    if (!journey) {
      const journeyDate = dateInTimeZone(new Date(), config.timeZone, definition.days);
      const departure = zonedDateTime(journeyDate, definition.time, config.timeZone);
      journey = await client.post('/super-admin/manage/journeys', {
        routeId: definition.route.id, trainId: train.id, serviceNumber: definition.serviceNumber,
        journeyDate, scheduledDepartureAt: departure.toISOString(),
        scheduledArrivalAt: new Date(departure.getTime() + timetable.at(-1).arrivalOffsetMinutes * 60000).toISOString(),
        status: 'SCHEDULED', bookingOpensAt: new Date().toISOString(),
        bookingClosesAt: new Date(departure.getTime() - 30 * 60000).toISOString(),
      }, `bootstrap:journey:${definition.serviceNumber}:${journeyDate}`);
      await client.post(`/super-admin/manage/journeys/${journey.id}/snapshots`, {}, `bootstrap:snapshots:${journey.id}`);
    }
    journeys.push(journey);
  }
  return journeys;
}

async function provisionFare(client, route, validFrom) {
  const fares = rows(await client.get(`/super-admin/manage/fare-rules?routeId=${route.id}`));
  let fare = fares.find((item) => item.name === 'Interview Main Line Standard Fare');
  if (!fare) fare = await client.post('/super-admin/manage/fare-rules', {
    routeId: route.id, name: 'Interview Main Line Standard Fare', baseFare: '100.00', pricePerKm: '5.5000', minimumFare: '200.00', currency: 'LKR', validFrom, validUntil: null, priority: 100, isActive: true,
    classes: [{ coachClass: 'FIRST_CLASS', multiplier: '2.000' }, { coachClass: 'SECOND_CLASS', multiplier: '1.000' }, { coachClass: 'THIRD_CLASS', multiplier: '0.750' }],
    passengerRules: [{ passengerType: 'ADULT', discountPercentage: '0.00', isActive: true }, { passengerType: 'CHILD', discountPercentage: '50.00', isActive: true }],
  }, `bootstrap:fare:${route.id}`);
  return fare;
}

async function provisionAssignments(client, admin, staff, journeys, colomboFort) {
  const assignedJourneys = rows(await client.get(`/super-admin/admins/${admin.id}/journeys`));
  const ids = new Set(assignedJourneys.map((item) => item.journeyId || item.journey?.id));
  for (const journey of journeys) if (!ids.has(journey.id)) await client.post(`/super-admin/admins/${admin.id}/journeys`, { journeyId: journey.id }, `bootstrap:assignment:admin:${admin.id}:${journey.id}`);
  const stations = rows(await client.get(`/admin/staff/${staff.id}/stations`));
  if (!stations.some((item) => (item.stationId || item.station?.id) === colomboFort.id)) await client.post(`/admin/staff/${staff.id}/stations`, { stationId: colomboFort.id }, `bootstrap:assignment:staff:${staff.id}:${colomboFort.id}`);
}

async function verify(client, context) {
  const train = await client.get(`/super-admin/manage/trains/${context.train.id}`);
  const details = await Promise.all(context.journeys.map((journey) => client.get(`/journeys/${journey.id}`)));
  const checks = {
    superAdmin: (await client.get('/auth/me')).role === 'SUPER_ADMIN',
    stations: context.stations.length === 79,
    coaches: train.coaches.length === 8,
    reservedCoaches: train.coaches.filter((coach) => coach.reservationType === 'RESERVED').length === 3,
    unreservedCoaches: train.coaches.filter((coach) => coach.reservationType === 'UNRESERVED').length === 5,
    reservedSeats: train.coaches.filter((coach) => coach.reservationType === 'RESERVED').reduce((sum, coach) => sum + coach.seats.length, 0) === 120,
    journeys: details.length === 3,
    snapshots: details.every((journey) => journey.stations.length === 79 && journey.coaches.length === 8),
    reverseOrder: details[2].stations[0].station.code === 'BAD' && details[2].stations.at(-1).station.code === 'FOT',
  };
  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  if (failed.length) throw new Error(`Bootstrap verification failed: ${failed.join(', ')}`);
  return checks;
}

async function runBootstrap() {
  const config = loadBootstrapConfig();
  assertSeedData(stationData, coachData);
  const state = new BootstrapState();
  const client = new BootstrapClient(config, state);
  try {
    logger.info('[bootstrap] Waiting for authenticated API');
    await waitForApi(client);
    const superAdmin = config.users.find((user) => user.role === 'SUPER_ADMIN');
    await client.login(superAdmin.email, superAdmin.password);
    const current = await client.get('/auth/me');
    if (current.role !== 'SUPER_ADMIN') throw new Error('Bootstrap identity is not SUPER_ADMIN');
    logger.info('[bootstrap] Provisioning users through API');
    const admin = await provisionUser(client, config.users.find((user) => user.role === 'ADMIN'));
    const staff = await provisionUser(client, config.users.find((user) => user.role === 'STAFF'));
    logger.info('[bootstrap] Provisioning network through API');
    const stations = await provisionStations(client);
    const timetable = buildTimetable(stationData);
    const routes = await provisionRoutes(client, stations, timetable);
    const train = await provisionTrain(client);
    logger.info('[bootstrap] Provisioning journeys, fares, and assignments through API');
    const journeys = await provisionJourneys(client, config, routes, train, timetable);
    await provisionFare(client, routes.outbound, journeys[0].journeyDate);
    await provisionFare(client, routes.reverse, journeys[2].journeyDate);
    await provisionAssignments(client, admin, staff, journeys, stations[0]);
    const checks = await verify(client, { stations, routes, train, journeys });
    logger.info({ checks }, '[bootstrap] Interview environment is ready');
    return { stations, routes, train, journeys, checks };
  } finally {
    state.clear();
  }
}

if (require.main === module) runBootstrap().catch((error) => { logger.error({ phase: 'authenticated-api-bootstrap', code: error.code, status: error.status, message: error.message }, 'Bootstrap failed'); process.exitCode = 1; });

module.exports = { runBootstrap, waitForApi, provisionStations, provisionTrain, provisionJourneys };
