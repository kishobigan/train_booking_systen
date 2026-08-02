'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const ConflictError = require('../../../src/common/errors/ConflictError');
const NotFoundError = require('../../../src/common/errors/NotFoundError');
const ValidationError = require('../../../src/common/errors/ValidationError');
const TrainService = require('../../../src/modules/trains/train.service');

function fixture() {
  const records = new Map();
  let id = 0;
  const createRecord = (values) => ({
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
    async destroy() {
      records.delete(this.id);
    },
  });
  const repository = {
    async create(values) {
      const train = createRecord({ id: `t${++id}`, ...values });
      records.set(train.id, train);
      return train;
    },
    async findById(trainId) {
      return records.get(trainId) || null;
    },
    async findByNumber(trainNumber) {
      return [...records.values()].find((train) => train.trainNumber === trainNumber) || null;
    },
    async findConfiguration(trainId) {
      return records.get(trainId) || null;
    },
    async paginate(where, options) {
      return { rows: [], total: 0, where, options };
    },
  };
  return { records, repository, service: new TrainService(repository), createRecord };
}

test('creates, reads, updates and deletes normalized trains', async () => {
  const data = fixture();
  const train = await data.service.createTrain({
    trainNumber: ' udr-01 ',
    name: ' Udarata ',
    id: 'ignored',
  });
  assert.equal(train.trainNumber, 'UDR-01');
  assert.equal((await data.service.getTrainByNumber(' udr-01 ')).id, train.id);
  assert.equal((await data.service.updateTrain(train.id, { name: 'Express' })).name, 'Express');
  assert.equal(await data.service.deleteTrain(train.id), true);
  await assert.rejects(() => data.service.getTrain(train.id), NotFoundError);
});

test('rejects missing and duplicate train numbers', async () => {
  const data = fixture();
  await assert.rejects(() => data.service.createTrain({ name: 'Missing' }), ValidationError);
  await data.service.createTrain({ trainNumber: 'T1' });
  await assert.rejects(() => data.service.createTrain({ trainNumber: 't1' }), ConflictError);
});

test('calculates declared and configured capacity with breakdowns', async () => {
  const data = fixture();
  const train = data.createRecord({
    id: 't1',
    trainNumber: 'T1',
    coaches: [
      {
        id: 'c1',
        coachNumber: 'A',
        coachClass: 'FIRST_CLASS',
        reservationType: 'RESERVED',
        totalSeats: 2,
        isActive: true,
        seats: [{ isActive: true }, { isActive: true }],
      },
      {
        id: 'c2',
        coachNumber: 'B',
        coachClass: 'SECOND_CLASS',
        reservationType: 'RESERVED',
        totalSeats: 3,
        isActive: true,
        seats: [{ isActive: true }, { isActive: false }],
      },
      {
        id: 'c3',
        coachNumber: 'C',
        coachClass: 'THIRD_CLASS',
        reservationType: 'UNRESERVED',
        totalSeats: 50,
        isActive: false,
        seats: [],
      },
    ],
  });
  data.records.set(train.id, train);
  const capacity = await data.service.calculateCapacity(train.id);
  assert.equal(capacity.totalCapacity, 5);
  assert.equal(capacity.configuredSeatCount, 3);
  assert.equal(capacity.capacityDifference, 2);
  assert.equal(capacity.byClass.FIRST_CLASS, 2);
  assert.equal(capacity.byReservationType.RESERVED, 5);
  assert.equal(capacity.isConfigurationConsistent, false);
});
