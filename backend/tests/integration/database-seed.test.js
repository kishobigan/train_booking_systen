'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.RUN_INTEGRATION_TESTS === 'true' && Boolean(process.env.DATABASE_URL);

test('database seed is complete, idempotent, and transactional', { skip: !enabled }, async () => {
  process.env.NODE_ENV = 'test';
  process.env.SEED_STAFF_STATION_CODES = 'FOT';

  const sequelize = require('../../src/database/sequelize');
  const models = require('../../src/models');
  const { runSeed } = require('../../src/db/seeds');

  try {
    const first = await runSeed();
    const scopedCounts = async (result) =>
      Promise.all([
        models.RouteStation.count({ where: { routeId: result.route.id } }),
        models.Coach.count({ where: { trainId: result.train.id } }),
        models.JourneyStation.count({ where: { journeyId: result.journey.id } }),
        models.JourneyCoach.count({ where: { journeyId: result.journey.id } }),
        models.JourneySeat.count({ where: { journeyId: result.journey.id } }),
        models.AdminJourney.count({ where: { journeyId: result.journey.id } }),
      ]);
    const countsAfterFirst = await scopedCounts(first);
    const second = await runSeed();
    assert.deepEqual(await scopedCounts(second), countsAfterFirst);
    assert.equal(first.journey.id, second.journey.id);

    process.env.SEED_STAFF_STATION_CODES = 'FOT,GPH';
    await assert.rejects(
      runSeed({
        beforeVerify: async () => {
          throw new Error('forced rollback');
        },
      }),
      /forced rollback/
    );
    const gampaha = await models.Station.findOne({ where: { code: 'GPH' } });
    assert.equal(
      await models.StaffStation.count({
        where: { staffUserId: first.users.STAFF.id, stationId: gampaha.id },
      }),
      0
    );
  } finally {
    await sequelize.close();
  }
});
