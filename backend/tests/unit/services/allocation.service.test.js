'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const AllocationService = require('../../../src/modules/bookings/allocation.service');
const BookingConflictError = require('../../../src/common/errors/BookingConflictError');
const ValidationError = require('../../../src/common/errors/ValidationError');

function fixture(createError) {
  const rows = [];
  const bookingSeat = { id: 'bs-1', journeyId: 'j-1', seatId: 's-1' };
  const repository = {
    async create(values) {
      if (createError) throw createError;
      const row = {
        ...values,
        async update(changes) {
          Object.assign(this, changes);
        },
      };
      rows.push(row);
      return row;
    },
    async acquireSeatLocks() {},
    model: {
      async destroy({ where }) {
        const index = rows.findIndex((row) => row.bookingSeatId === where.bookingSeatId);
        if (index >= 0) rows.splice(index, 1);
        return index >= 0 ? 1 : 0;
      },
    },
    async findByBookingSeat(id) {
      return rows.find((row) => row.bookingSeatId === id) || null;
    },
    async deleteByBooking() {
      rows.length = 0;
    },
  };
  const bookingSeatRepository = {
    async findById(id) {
      return id === bookingSeat.id ? bookingSeat : null;
    },
    async updateById(id, values) {
      Object.assign(bookingSeat, values);
      return bookingSeat;
    },
    async findByBooking() {
      return [bookingSeat];
    },
    async updateStatusesByBooking(id, status) {
      bookingSeat.status = status;
    },
  };
  return {
    rows,
    bookingSeat,
    service: new AllocationService({
      allocationRepository: repository,
      bookingSeatRepository,
      seatAvailabilityService: {},
    }),
  };
}
const held = {
  bookingSeatId: 'bs-1',
  journeyId: 'j-1',
  seatId: 's-1',
  originSequence: 0,
  destinationSequence: 3,
  allocationType: 'HELD',
  expiresAt: new Date(Date.now() + 60_000),
  transaction: {},
};

test('creates, confirms, expires and idempotently releases allocations', async () => {
  const data = fixture();
  await data.service.createAllocation(held);
  assert.equal(data.rows[0].allocationType, 'HELD');
  await data.service.confirmAllocation({ bookingSeatId: 'bs-1', transaction: {} });
  assert.equal(data.rows[0].allocationType, 'CONFIRMED');
  assert.equal(data.rows[0].expiresAt, null);
  await data.service.expireAllocation({ bookingSeatId: 'bs-1', transaction: {} });
  assert.equal(data.rows.length, 0);
  assert.equal(data.bookingSeat.status, 'EXPIRED');
  assert.equal(await data.service.releaseAllocation({ bookingSeatId: 'bs-1', transaction: {} }), 0);
});

test('validates allocation expiry and maps exclusion conflicts', async () => {
  await assert.rejects(
    () => fixture().service.createAllocation({ ...held, expiresAt: null }),
    ValidationError
  );
  await assert.rejects(
    () =>
      fixture().service.createAllocation({ ...held, originSequence: 3, destinationSequence: 2 }),
    TypeError
  );
  const databaseError = Object.assign(new Error('excluded'), { original: { code: '23P01' } });
  await assert.rejects(
    () => fixture(databaseError).service.createAllocation(held),
    BookingConflictError
  );
});
