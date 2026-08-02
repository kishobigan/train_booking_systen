'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const ConflictError = require('../../../src/common/errors/ConflictError');
const NotFoundError = require('../../../src/common/errors/NotFoundError');
const ValidationError = require('../../../src/common/errors/ValidationError');
const SeatService = require('../../../src/modules/seats/seat.service');

function fixture() {
  const seats = [];
  const coaches = new Map([
    ['c1', coachRecord('c1')],
    ['c2', coachRecord('c2')],
  ]);
  let id = 0;
  function coachRecord(coachId) {
    return {
      id: coachId,
      totalSeats: 0,
      async update(changes) {
        Object.assign(this, changes);
        return this;
      },
    };
  }
  function seatRecord(values) {
    return {
      ...values,
      async update(changes) {
        Object.assign(this, changes);
        return this;
      },
      async destroy() {
        seats.splice(seats.indexOf(this), 1);
      },
    };
  }
  const seatRepository = {
    async create(values) {
      const seat = seatRecord({ id: `s${++id}`, ...values });
      seats.push(seat);
      return seat;
    },
    async bulkCreate(values) {
      return Promise.all(values.map((value) => this.create(value)));
    },
    async findById(seatId) {
      return seats.find((seat) => seat.id === seatId) || null;
    },
    async findByCoachAndNumber(coachId, seatNumber) {
      return (
        seats.find((seat) => seat.coachId === coachId && seat.seatNumber === seatNumber) || null
      );
    },
    async findByCoachAndNumbers(coachId, numbers) {
      return seats.filter((seat) => seat.coachId === coachId && numbers.includes(seat.seatNumber));
    },
    async count(where) {
      return seats.filter((seat) => seat.coachId === where.coachId).length;
    },
    async deleteByCoach(coachId) {
      for (let index = seats.length - 1; index >= 0; index -= 1)
        if (seats[index].coachId === coachId) seats.splice(index, 1);
    },
    async paginate(where, options) {
      return { rows: [], where, options };
    },
  };
  const coachRepository = {
    async findById(coachId) {
      return coaches.get(coachId) || null;
    },
  };
  const transactionProvider = {
    async transaction(callback) {
      return callback({ id: 'tx' });
    },
  };
  return {
    coaches,
    seats,
    service: new SeatService({ seatRepository, coachRepository, transactionProvider }),
  };
}

test('creates, reads, updates and deletes seats while synchronizing capacity', async () => {
  const data = fixture();
  const seat = await data.service.createSeat({
    coachId: 'c1',
    seatNumber: ' 1a ',
    rowNumber: 1,
    columnNumber: 1,
    ignored: true,
  });
  assert.equal(seat.seatNumber, '1A');
  assert.equal(data.coaches.get('c1').totalSeats, 1);
  assert.equal((await data.service.getSeatByNumber('c1', '1a')).id, seat.id);
  await data.service.updateSeat(seat.id, { coachId: 'c2', seatNumber: ' 2b ' });
  assert.equal(data.coaches.get('c1').totalSeats, 0);
  assert.equal(data.coaches.get('c2').totalSeats, 1);
  await data.service.deleteSeat(seat.id);
  assert.equal(data.coaches.get('c2').totalSeats, 0);
  await assert.rejects(() => data.service.getSeat(seat.id), NotFoundError);
});

test('bulk creates normalized seats and rejects batch duplicates', async () => {
  const data = fixture();
  const created = await data.service.bulkCreateSeats('c1', [
    { seatNumber: '1a', rowNumber: 1, columnNumber: 1 },
    { seatNumber: '1b', rowNumber: 1, columnNumber: 2, isWindow: true },
  ]);
  assert.deepEqual(
    created.map((seat) => seat.seatNumber),
    ['1A', '1B']
  );
  assert.equal(data.coaches.get('c1').totalSeats, 2);
  await assert.rejects(
    () => data.service.bulkCreateSeats('c1', [{ seatNumber: '2A' }, { seatNumber: '2a' }]),
    ConflictError
  );
});

test('detects persisted conflicts and supports explicit replacement', async () => {
  const data = fixture();
  await data.service.bulkCreateSeats('c1', [{ seatNumber: '1A' }]);
  await assert.rejects(
    () => data.service.bulkCreateSeats('c1', [{ seatNumber: '1a' }]),
    ConflictError
  );
  const replacements = await data.service.bulkCreateSeats('c1', [{ seatNumber: '9A' }], {
    replace: true,
  });
  assert.equal(replacements[0].seatNumber, '9A');
  assert.equal(data.seats.length, 1);
});

test('validates bulk input and seat coordinates', async () => {
  const data = fixture();
  await assert.rejects(() => data.service.bulkCreateSeats('c1', []), ValidationError);
  await assert.rejects(
    () => data.service.createSeat({ coachId: 'c1', seatNumber: '1A', rowNumber: 0 }),
    ValidationError
  );
});
