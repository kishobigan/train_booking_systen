'use strict';
const test = require('node:test');
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
test('repositories execute representative read queries', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = 'test';
  const sequelize = require('../../src/database/sequelize');
  const repositories = require('../../src/container/repositories');
  try {
    await repositories.stationRepository.findActive({ limit: 1 });
    await repositories.routeRepository.findActive({ limit: 1 });
    await repositories.trainRepository.findActive({ limit: 1 });
    await repositories.journeyRepository.search({}, { limit: 1 });
    await repositories.bookingRepository.findExpiredHolds(new Date(), { limit: 1 });
    await repositories.bookingSeatRepository.findByJourneyAndSegment(
      '00000000-0000-0000-0000-000000000000',
      0,
      1,
      { limit: 1 }
    );
    await repositories.activeSeatAllocationRepository.findConflicts(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000000',
      0,
      1,
      { limit: 1 }
    );
    await repositories.notificationRepository.findPending(new Date(), { limit: 1 });
    await repositories.auditRepository.findAll({}, { limit: 1 });
  } finally {
    await sequelize.close();
  }
});
