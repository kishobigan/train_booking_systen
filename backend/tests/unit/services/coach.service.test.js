'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const ConflictError = require('../../../src/common/errors/ConflictError');
const ValidationError = require('../../../src/common/errors/ValidationError');
const CoachService = require('../../../src/modules/coaches/coach.service');

function fixture() {
  const coaches = new Map();
  const seats = [];
  let coachId = 0;
  const record = (values) => ({
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
    async destroy() {
      coaches.delete(this.id);
    },
  });
  const coachRepository = {
    async create(values) {
      const coach = record({ id: `c${++coachId}`, ...values });
      coaches.set(coach.id, coach);
      return coach;
    },
    async findById(id) {
      return coaches.get(id) || null;
    },
    async findByTrainAndNumber(trainId, coachNumber) {
      return (
        [...coaches.values()].find(
          (coach) => coach.trainId === trainId && coach.coachNumber === coachNumber
        ) || null
      );
    },
    async findByTrainAndPosition(trainId, positionNumber) {
      return (
        [...coaches.values()].find(
          (coach) => coach.trainId === trainId && coach.positionNumber === positionNumber
        ) || null
      );
    },
    async findByTrain(trainId) {
      return [...coaches.values()].filter((coach) => coach.trainId === trainId);
    },
    async findWithSeats(id) {
      const coach = coaches.get(id);
      return coach ? { ...coach, seats: seats.filter((seat) => seat.coachId === id) } : null;
    },
  };
  const seatRepository = {
    async count(where) {
      return seats.filter((seat) => seat.coachId === where.coachId).length;
    },
    async bulkCreate(values) {
      seats.push(...values);
      return values;
    },
    async deleteByCoach(id) {
      for (let index = seats.length - 1; index >= 0; index -= 1)
        if (seats[index].coachId === id) seats.splice(index, 1);
    },
  };
  const trainRepository = {
    async findById(id) {
      return id === 't1' ? { id } : null;
    },
  };
  const transactionProvider = {
    async transaction(callback) {
      return callback({ id: 'tx' });
    },
  };
  const service = new CoachService({
    coachRepository,
    seatRepository,
    trainRepository,
    transactionProvider,
  });
  return { coaches, seats, service };
}

const validCoach = {
  trainId: 't1',
  coachNumber: ' a ',
  coachClass: 'FIRST_CLASS',
  reservationType: 'RESERVED',
  positionNumber: 1,
  totalSeats: 4,
};

test('creates, updates, lists and deletes coaches', async () => {
  const data = fixture();
  const coach = await data.service.createCoach(validCoach);
  assert.equal(coach.coachNumber, 'A');
  assert.equal((await data.service.listCoaches('t1')).length, 1);
  assert.equal((await data.service.updateCoach(coach.id, { coachNumber: ' b ' })).coachNumber, 'B');
  assert.equal(await data.service.deleteCoach(coach.id), true);
});

test('rejects duplicate coach numbers and positions', async () => {
  const data = fixture();
  await data.service.createCoach(validCoach);
  await assert.rejects(
    () => data.service.createCoach({ ...validCoach, coachNumber: 'A', positionNumber: 2 }),
    ConflictError
  );
  await assert.rejects(
    () => data.service.createCoach({ ...validCoach, coachNumber: 'B' }),
    ConflictError
  );
});

test('generates deterministic seat metadata and synchronizes the coach', async () => {
  const data = fixture();
  const coach = await data.service.createCoach(validCoach);
  const generated = await data.service.generateSeats(coach.id, {
    rows: 2,
    columns: 2,
    aisleAfterColumns: [1],
    accessibleSeats: ['1A'],
  });
  assert.deepEqual(
    generated.map((seat) => seat.seatNumber),
    ['1A', '1B', '2A', '2B']
  );
  assert.equal(generated[0].isWindow, true);
  assert.equal(generated[0].isAisle, true);
  assert.equal(generated[0].isAccessible, true);
  assert.equal(coach.totalSeats, 4);
  assert.deepEqual(coach.seatLayout.columnLabels, ['A', 'B']);
});

test('requires explicit replacement and validates layout capacity', async () => {
  const data = fixture();
  const coach = await data.service.createCoach(validCoach);
  await data.service.generateSeats(coach.id, { rows: 2, columns: 2 });
  await assert.rejects(
    () => data.service.generateSeats(coach.id, { rows: 2, columns: 2 }),
    ConflictError
  );
  await data.service.generateSeats(coach.id, { rows: 1, columns: 4, replace: true });
  assert.equal(data.seats.length, 4);
  await assert.rejects(
    () =>
      data.service.generateSeats(coach.id, { rows: 1, columns: 2, totalSeats: 4, replace: true }),
    ValidationError
  );
});
