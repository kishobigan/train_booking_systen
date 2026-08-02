'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const ConflictError = require('../../../src/common/errors/ConflictError');
const NotFoundError = require('../../../src/common/errors/NotFoundError');
const ValidationError = require('../../../src/common/errors/ValidationError');
const StationService = require('../../../src/modules/stations/station.service');

function createFixture() {
  const calls = [];
  const records = new Map();
  const repository = {
    async findByCode(code) {
      return [...records.values()].find((record) => record.code === code) || null;
    },
    async create(values) {
      const record = createRecord({ id: 'station-1', ...values });
      records.set(record.id, record);
      calls.push(['create', values]);
      return record;
    },
    async findById(id) {
      return records.get(id) || null;
    },
    async paginate(where, options) {
      calls.push(['paginate', where, options]);
      return { rows: [], total: 0 };
    },
    async search(term, options) {
      calls.push(['search', term, options]);
      return [];
    },
  };
  function createRecord(values) {
    return {
      ...values,
      async update(changes) {
        Object.assign(this, changes);
        calls.push(['update', changes]);
        return this;
      },
      async destroy() {
        calls.push(['destroy', this.id]);
        records.delete(this.id);
      },
    };
  }
  return { calls, records, repository, service: new StationService(repository), createRecord };
}

test('creates a normalized station using whitelisted fields', async () => {
  const { service } = createFixture();
  const station = await service.createStation({
    code: ' fot ',
    name: ' Colombo Fort ',
    id: 'ignored',
  });
  assert.equal(station.code, 'FOT');
  assert.equal(station.name, 'Colombo Fort');
  assert.equal(station.id, 'station-1');
});

test('rejects missing fields and duplicate station codes', async () => {
  const fixture = createFixture();
  await assert.rejects(() => fixture.service.createStation({ code: 'FOT' }), ValidationError);
  fixture.records.set('existing', fixture.createRecord({ id: 'existing', code: 'FOT' }));
  await assert.rejects(
    () => fixture.service.createStation({ code: 'fot', name: 'Fort' }),
    ConflictError
  );
});

test('gets, updates and deletes stations', async () => {
  const fixture = createFixture();
  fixture.records.set(
    'station-1',
    fixture.createRecord({ id: 'station-1', code: 'FOT', name: 'Fort' })
  );
  assert.equal((await fixture.service.getStation('station-1')).code, 'FOT');
  assert.equal(
    (await fixture.service.updateStation('station-1', { name: ' Colombo Fort ' })).name,
    'Colombo Fort'
  );
  assert.equal(await fixture.service.deleteStation('station-1'), true);
  await assert.rejects(() => fixture.service.getStation('station-1'), NotFoundError);
});

test('lists with pagination and performs bounded search', async () => {
  const { calls, service } = createFixture();
  await service.listStations({ isActive: true, page: 2, pageSize: 10 });
  await service.searchStations(' colombo ', { limit: 1000 });
  assert.deepEqual(calls[0].slice(0, 2), ['paginate', { isActive: true }]);
  assert.deepEqual(calls[1], ['search', 'colombo', { limit: 100 }]);
  assert.throws(() => service.searchStations('  '), ValidationError);
});
