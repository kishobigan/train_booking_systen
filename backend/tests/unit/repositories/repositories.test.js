'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const BaseRepository = require('../../../src/common/repositories/BaseRepository');
const repositories = require('../../../src/container/repositories');
test('repository container exposes every requested repository', () => {
  assert.equal(Object.keys(repositories).length, 35);
  for (const repository of Object.values(repositories)) {
    assert(
      repository instanceof BaseRepository ||
        [
          'AvailabilityRepository',
          'ReportRepository',
          'SeatMapRepository',
          'JobExecutionRepository',
        ].includes(repository.constructor.name)
    );
    if (repository instanceof BaseRepository) assert(repository.model);
  }
});
test('base repository produces bounded pagination metadata', async () => {
  const model = {
    findAndCountAll: async (query) => ({ count: 45, rows: [query.limit, query.offset] }),
  };
  const result = await new BaseRepository(model).paginate(
    { isActive: true },
    { page: 2, pageSize: 20 }
  );
  assert.deepEqual(result, { rows: [20, 20], page: 2, pageSize: 20, total: 45, totalPages: 3 });
});
