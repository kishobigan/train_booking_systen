'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const ConflictError = require('../../../src/common/errors/ConflictError');
const NotFoundError = require('../../../src/common/errors/NotFoundError');
const ValidationError = require('../../../src/common/errors/ValidationError');
const JOURNEY_STATUS = require('../../../src/common/constants/journey-status.constants');
const JourneyService = require('../../../src/modules/journeys/journey.service');

function record(values, collection) {
  return {
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
    async destroy() {
      collection.splice(collection.indexOf(this), 1);
    },
  };
}

function fixture() {
  const journeys = [];
  const stations = [];
  const coaches = [];
  const seats = [];
  let journeyId = 0;
  let snapshotId = 0;
  const route = {
    id: 'route-1',
    routeStations: [
      {
        stationId: 'station-1',
        sequenceNumber: 0,
        distanceFromStartKm: 0,
        defaultArrivalOffsetMinutes: 0,
        defaultDepartureOffsetMinutes: 5,
        canBoard: true,
        canAlight: false,
      },
      {
        stationId: 'station-2',
        sequenceNumber: 1,
        distanceFromStartKm: 100,
        defaultArrivalOffsetMinutes: 120,
        defaultDepartureOffsetMinutes: 125,
        canBoard: false,
        canAlight: true,
      },
    ],
  };
  const train = {
    id: 'train-1',
    coaches: [
      {
        id: 'coach-1',
        coachNumber: 'A',
        coachClass: 'FIRST_CLASS',
        reservationType: 'RESERVED',
        positionNumber: 1,
        isActive: true,
        seats: [
          { id: 'seat-1', seatNumber: '1A', isActive: true },
          { id: 'seat-2', seatNumber: '1B', isActive: false },
        ],
      },
    ],
  };
  const journeyRepository = {
    async create(values) {
      const journey = record({ id: `journey-${++journeyId}`, ...values }, journeys);
      journeys.push(journey);
      return journey;
    },
    async findById(id) {
      return journeys.find((journey) => journey.id === id) || null;
    },
    async findSnapshot(id) {
      return this.findById(id);
    },
    async findByTrainAndDeparture(trainId, departure) {
      const instant = new Date(departure).getTime();
      return (
        journeys.find(
          (journey) =>
            journey.trainId === trainId &&
            new Date(journey.scheduledDepartureAt).getTime() === instant
        ) || null
      );
    },
    async search(filters, options) {
      return { rows: journeys, filters, options };
    },
  };
  function snapshotRepository(collection) {
    return {
      async bulkCreate(values) {
        const created = values.map((value) =>
          record({ id: `snapshot-${++snapshotId}`, ...value }, collection)
        );
        collection.push(...created);
        return created;
      },
      async count(where) {
        return collection.filter((item) => item.journeyId === where.journeyId).length;
      },
      async deleteByJourney(id) {
        for (let index = collection.length - 1; index >= 0; index -= 1) {
          if (collection[index].journeyId === id) collection.splice(index, 1);
        }
      },
    };
  }
  const journeyStationRepository = {
    ...snapshotRepository(stations),
    async findByJourney(id) {
      return stations.filter((station) => station.journeyId === id);
    },
  };
  const transactionProvider = {
    async transaction(callback) {
      return callback({ id: 'transaction', LOCK: { UPDATE: 'UPDATE' } });
    },
  };
  const service = new JourneyService({
    journeyRepository,
    journeyStationRepository,
    journeyCoachRepository: snapshotRepository(coaches),
    journeySeatRepository: snapshotRepository(seats),
    routeRepository: {
      async findById(id) {
        return id === route.id ? route : null;
      },
      async findWithStations(id) {
        return id === route.id ? route : null;
      },
    },
    trainRepository: {
      async findById(id) {
        return id === train.id ? train : null;
      },
      async findConfiguration(id) {
        return id === train.id ? train : null;
      },
    },
    transactionProvider,
  });
  return { service, journeys, stations, coaches, seats };
}

async function createScheduledJourney(service, overrides = {}) {
  return service.createJourney({
    routeId: 'route-1',
    trainId: 'train-1',
    serviceNumber: ' ic-101 ',
    journeyDate: '2026-09-01',
    scheduledDepartureAt: '2026-09-01T02:00:00.000Z',
    scheduledArrivalAt: '2026-09-01T04:30:00.000Z',
    status: JOURNEY_STATUS.SCHEDULED,
    ...overrides,
  });
}

test('supports journey CRUD, search and duplicate departure protection', async () => {
  const data = fixture();
  const journey = await createScheduledJourney(data.service);
  assert.equal(journey.serviceNumber, 'IC-101');
  assert.equal((await data.service.getJourney(journey.id)).id, journey.id);
  assert.equal((await data.service.getJourneySnapshot(journey.id)).id, journey.id);
  assert.deepEqual((await data.service.searchJourneys({ status: 'SCHEDULED' })).filters, {
    status: 'SCHEDULED',
  });
  await data.service.updateJourney(journey.id, { serviceNumber: ' ic-102 ' });
  assert.equal(journey.serviceNumber, 'IC-102');
  await assert.rejects(() => createScheduledJourney(data.service), ConflictError);
  await assert.rejects(
    () => data.service.updateJourney(journey.id, { scheduledArrivalAt: '2026-09-01T01:00:00Z' }),
    ValidationError
  );
  assert.equal(await data.service.deleteJourney(journey.id), true);
  await assert.rejects(() => data.service.getJourney(journey.id), NotFoundError);
});

test('generates immutable route, coach and active-seat snapshots with explicit replacement', async () => {
  const data = fixture();
  const journey = await createScheduledJourney(data.service);
  const result = await data.service.generateSnapshots(journey.id);
  assert.equal(result.stations.length, 2);
  assert.equal(result.coaches.length, 1);
  assert.equal(result.seats.length, 1);
  assert.equal(result.seats[0].seatNumberSnapshot, '1A');
  assert.equal(result.seats[0].journeyCoachId, result.coaches[0].id);
  assert.equal(result.stations[1].scheduledArrivalAt.toISOString(), '2026-09-01T04:00:00.000Z');
  await assert.rejects(() => data.service.generateSnapshots(journey.id), ConflictError);
  const replacement = await data.service.generateSnapshots(journey.id, { replace: true });
  assert.equal(replacement.stations.length, 2);
  assert.equal(data.stations.length, 2);
  assert.equal(data.coaches.length, 1);
  assert.equal(data.seats.length, 1);
});

test('delays a journey and all generated station schedule snapshots', async () => {
  const data = fixture();
  const journey = await createScheduledJourney(data.service);
  await data.service.generateSnapshots(journey.id);
  const delayed = await data.service.delayJourney(journey.id, 30);
  assert.equal(delayed.status, JOURNEY_STATUS.DELAYED);
  assert.equal(new Date(delayed.scheduledDepartureAt).toISOString(), '2026-09-01T02:30:00.000Z');
  assert.equal(data.stations[1].scheduledArrivalAt.toISOString(), '2026-09-01T04:30:00.000Z');
  await assert.rejects(() => data.service.delayJourney(journey.id, 0), ValidationError);
});

test('cancels and completes journeys with lifecycle guards and idempotency', async () => {
  const cancelledData = fixture();
  const cancelled = await createScheduledJourney(cancelledData.service);
  assert.equal(
    (await cancelledData.service.cancelJourney(cancelled.id)).status,
    JOURNEY_STATUS.CANCELLED
  );
  assert.equal(await cancelledData.service.cancelJourney(cancelled.id), cancelled);
  await assert.rejects(() => cancelledData.service.completeJourney(cancelled.id), ConflictError);

  const completedData = fixture();
  const completed = await createScheduledJourney(completedData.service);
  const arrival = '2026-09-01T04:40:00.000Z';
  const result = await completedData.service.completeJourney(completed.id, arrival);
  assert.equal(result.status, JOURNEY_STATUS.COMPLETED);
  assert.equal(result.actualArrivalAt.toISOString(), arrival);
  assert.equal(await completedData.service.completeJourney(completed.id), completed);
  await assert.rejects(() => completedData.service.cancelJourney(completed.id), ConflictError);
});
