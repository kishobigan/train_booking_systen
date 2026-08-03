'use strict';

require('dotenv').config();

const { URL, URLSearchParams } = require('node:url');
const sequelize = require('../src/database/sequelize');
const models = require('../src/models');
const fetch = globalThis.fetch;

function serviceUrl(configuredUrl, hostname) {
  const url = new URL(configuredUrl);
  url.hostname = hostname;
  return url;
}

async function expectResponse(url, options) {
  const response = await fetch(url, options);
  if (!response.ok)
    throw new Error(`Smoke request failed: ${url.pathname} returned ${response.status}`);
  return response.json().catch(() => null);
}

async function verifyWebSocket(url) {
  const endpoint = new URL(process.env.NEXT_PUBLIC_WS_PATH, url);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/`;
  endpoint.search = new URLSearchParams({ EIO: '4', transport: 'polling' });
  const handshake = await fetch(endpoint);
  const payload = await handshake.text();
  if (!handshake.ok || !payload.startsWith('0')) throw new Error('Socket.IO handshake failed');
  const { sid } = JSON.parse(payload.slice(1));
  endpoint.searchParams.set('sid', sid);
  const post = (body) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body,
    });
  if (!(await post('40')).ok) throw new Error('Socket.IO connection failed');
  const connected = await fetch(endpoint);
  if (!(await connected.text()).includes('40')) throw new Error('Socket.IO did not connect');
  await post('41');
}

async function main() {
  const api = serviceUrl(process.env.NEXT_PUBLIC_API_BASE_URL, 'backend');
  const websocket = serviceUrl(process.env.NEXT_PUBLIC_WS_URL, 'backend');
  const frontend = new URL(`http://frontend:${process.env.PORT}`);

  await expectResponse(new URL(`${api.pathname}/health`, api));
  const frontendResponse = await fetch(frontend);
  if (!frontendResponse.ok)
    throw new Error(`Frontend smoke verification returned ${frontendResponse.status}`);

  for (const path of ['/stations?search=Colombo', '/routes']) {
    await expectResponse(new URL(`${api.pathname}${path}`, api));
  }

  const [route, train, journeys, users] = await Promise.all([
    models.Route.findOne({ where: { code: 'CMB-BAD-MAIN', isActive: true } }),
    models.Train.findOne({ where: { trainNumber: '1005', isActive: true } }),
    models.Journey.findAll({
      where: { serviceNumber: ['DEMO-1005-A', 'DEMO-1005-B', 'DEMO-1006-R'] },
      order: [['scheduledDepartureAt', 'ASC']],
    }),
    models.User.unscoped().findAll({
      where: { email: process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@railway.local' },
    }),
  ]);
  if (!route || !train || journeys.length !== 3 || users.length !== 1)
    throw new Error('Required seed records are missing');
  const journey = journeys.find((item) => item.serviceNumber === 'DEMO-1005-A');

  const endpoints = await models.Station.findAll({
    where: { id: [route.startStationId, route.endStationId] },
  });
  if (endpoints.length !== 2) throw new Error('Seed route endpoints are missing');
  const journeyStops = await models.JourneyStation.findAll({
    where: { journeyId: journey.id },
    order: [['sequenceNumber', 'ASC']],
  });
  const origin = journeyStops[0];
  const destination = journeyStops.at(-1);
  const search = new URL(`${api.pathname}/journeys/search`, api);
  search.search = new URLSearchParams({
    originStationId: origin.stationId,
    destinationStationId: destination.stationId,
    date: journey.journeyDate,
  });
  await expectResponse(search);
  await expectResponse(new URL(`${api.pathname}/journeys/${journey.id}`, api));
  const seatMap = new URL(`${api.pathname}/journeys/${journey.id}/seat-map`, api);
  seatMap.search = new URLSearchParams({
    originJourneyStationId: origin.id,
    destinationJourneyStationId: destination.id,
  });
  await expectResponse(seatMap);
  await expectResponse(new URL(`${api.pathname}/fares/quote`, api), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      journeyId: journey.id,
      originJourneyStationId: origin.id,
      destinationJourneyStationId: destination.id,
      coachClass: 'SECOND_CLASS',
      passengers: [{ passengerType: 'ADULT' }],
    }),
  });

  const coachCounts = await models.Coach.findAll({ where: { trainId: train.id } });
  if (
    coachCounts.length !== 8 ||
    coachCounts.filter((coach) => coach.reservationType === 'RESERVED').length !== 3 ||
    coachCounts.filter((coach) => coach.reservationType === 'UNRESERVED').length !== 5
  ) throw new Error('Seed train coach configuration is invalid');

  const admin = await models.User.findOne({ where: { email: process.env.SEED_ADMIN_EMAIL } });
  const staff = await models.User.findOne({ where: { email: process.env.SEED_STAFF_EMAIL } });
  if ((await models.AdminJourney.count({ where: { adminUserId: admin.id, isActive: true } })) < 3)
    throw new Error('Admin journey assignments are incomplete');
  if ((await models.StaffStation.count({ where: { staffUserId: staff.id, stationId: origin.stationId, isActive: true } })) !== 1)
    throw new Error('Staff Colombo Fort assignment is missing');

  const credentials = [
    ['SEED_SUPER_ADMIN_EMAIL', 'SEED_SUPER_ADMIN_PASSWORD'],
    ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'],
    ['SEED_STAFF_EMAIL', 'SEED_STAFF_PASSWORD'],
  ];
  for (const [emailName, passwordName] of credentials) {
    await expectResponse(new URL(`${api.pathname}/auth/login`, api), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: process.env[emailName],
        password: process.env[passwordName],
      }),
    });
  }

  await verifyWebSocket(websocket);
  process.stdout.write('System smoke verification completed successfully.\n');
}

main()
  .catch((error) => {
    process.stderr.write(`System smoke verification failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
