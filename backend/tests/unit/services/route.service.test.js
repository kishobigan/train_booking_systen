'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const ConflictError = require('../../../src/common/errors/ConflictError');
const ValidationError = require('../../../src/common/errors/ValidationError');
const RouteService = require('../../../src/modules/routes/route.service');

function fixture() {
  const routes = new Map();
  const routeStations = [];
  const stations = new Map(['s1', 's2', 's3'].map((id) => [id, { id }]));
  let routeNumber = 0;
  let routeStationNumber = 0;
  const record = (values, collection) => ({
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
    async destroy() {
      if (collection instanceof Map) collection.delete(this.id);
      else collection.splice(collection.indexOf(this), 1);
    },
    async reload() {
      return this;
    },
  });
  const routeRepository = {
    async create(values) {
      const item = record({ id: `r${++routeNumber}`, ...values }, routes);
      routes.set(item.id, item);
      return item;
    },
    async findById(id) {
      return routes.get(id) || null;
    },
    async findByCode(code) {
      return [...routes.values()].find((item) => item.code === code) || null;
    },
    async findWithStations(id) {
      const route = routes.get(id);
      return route
        ? {
            ...route,
            routeStations: routeStations
              .filter((item) => item.routeId === id)
              .sort((a, b) => a.sequenceNumber - b.sequenceNumber),
          }
        : null;
    },
    async paginate() {
      return { rows: [], total: 0 };
    },
  };
  const routeStationRepository = {
    async findByRoute(routeId) {
      return routeStations
        .filter((item) => item.routeId === routeId)
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    },
    async findByRouteAndStation(routeId, stationId) {
      return (
        routeStations.find((item) => item.routeId === routeId && item.stationId === stationId) ||
        null
      );
    },
    async create(values) {
      const item = record({ id: `rs${++routeStationNumber}`, ...values }, routeStations);
      routeStations.push(item);
      return item;
    },
    async bulkCreate(values) {
      return Promise.all(values.map((value) => this.create(value)));
    },
  };
  const stationRepository = {
    async findById(id) {
      return stations.get(id) || null;
    },
  };
  const transactionProvider = {
    async transaction(callback) {
      return callback({ LOCK: { UPDATE: 'UPDATE' } });
    },
  };
  const service = new RouteService({
    routeRepository,
    routeStationRepository,
    stationRepository,
    transactionProvider,
  });
  return { routeRepository, routeStationRepository, routeStations, routes, service };
}

async function seedRoute(data) {
  const route = await data.routeRepository.create({
    code: 'MAIN',
    name: 'Main',
    startStationId: 's1',
    endStationId: 's3',
    totalDistanceKm: '100.00',
    isActive: true,
  });
  await data.routeStationRepository.bulkCreate([
    {
      routeId: route.id,
      stationId: 's1',
      sequenceNumber: 0,
      distanceFromStartKm: '0',
      defaultDepartureOffsetMinutes: 0,
      stopDurationMinutes: 0,
      canBoard: true,
      canAlight: false,
    },
    {
      routeId: route.id,
      stationId: 's3',
      sequenceNumber: 1,
      distanceFromStartKm: '100',
      defaultArrivalOffsetMinutes: 120,
      stopDurationMinutes: 0,
      canBoard: false,
      canAlight: true,
    },
  ]);
  return route;
}

test('creates, updates and deletes routes with normalized codes', async () => {
  const data = fixture();
  const route = await data.service.createRoute({
    code: ' main ',
    name: ' Main ',
    startStationId: 's1',
    endStationId: 's2',
    ignored: true,
  });
  assert.equal(route.code, 'MAIN');
  assert.equal((await data.service.updateRoute(route.id, { name: 'Updated' })).name, 'Updated');
  assert.equal(await data.service.deleteRoute(route.id), true);
});

test('rejects duplicate codes and identical endpoints', async () => {
  const data = fixture();
  await data.service.createRoute({
    code: 'MAIN',
    name: 'Main',
    startStationId: 's1',
    endStationId: 's2',
  });
  await assert.rejects(
    () =>
      data.service.createRoute({
        code: 'main',
        name: 'Other',
        startStationId: 's2',
        endStationId: 's3',
      }),
    ConflictError
  );
  await assert.rejects(
    () =>
      data.service.createRoute({ code: 'X', name: 'X', startStationId: 's1', endStationId: 's1' }),
    ValidationError
  );
});

test('adds, reorders and removes route stations atomically', async () => {
  const data = fixture();
  const route = await seedRoute(data);
  const added = await data.service.addStation(route.id, {
    stationId: 's2',
    sequenceNumber: 1,
    distanceFromStartKm: 50,
    canBoard: true,
    canAlight: true,
  });
  assert.deepEqual(
    (await data.routeStationRepository.findByRoute(route.id)).map((item) => item.stationId),
    ['s1', 's2', 's3']
  );
  const records = await data.routeStationRepository.findByRoute(route.id);
  await data.service.reorderStations(route.id, [records[2].id, records[1].id, records[0].id]);
  const reordered = await data.routeStationRepository.findByRoute(route.id);
  assert.deepEqual(
    reordered.map((item) => item.stationId),
    ['s3', 's2', 's1']
  );
  assert.equal(route.startStationId, 's3');
  assert.equal(route.endStationId, 's1');
  await data.service.removeStation(route.id, added.id);
  assert.deepEqual(
    (await data.routeStationRepository.findByRoute(route.id)).map((item) => item.sequenceNumber),
    [0, 1]
  );
  assert.equal(route.startStationId, 's3');
  assert.equal(route.endStationId, 's1');
});

test('clones a route in reverse with recalculated snapshots', async () => {
  const data = fixture();
  const route = await seedRoute(data);
  const reversed = await data.service.cloneReverseRoute(route.id, { code: 'REV' });
  assert.equal(reversed.code, 'REV');
  assert.equal(reversed.startStationId, 's3');
  assert.deepEqual(
    reversed.routeStations.map((item) => item.stationId),
    ['s3', 's1']
  );
  assert.deepEqual(
    reversed.routeStations.map((item) => item.distanceFromStartKm),
    [0, 100]
  );
  assert.equal(reversed.routeStations[0].canBoard, true);
});
