'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const AccessControlService = require('../../../src/modules/access-control/access-control.service');
const AuthorizationError = require('../../../src/common/errors/AuthorizationError');
function fixture() {
  const journeys = new Set(['admin-1:j-1']);
  const stations = new Set(['staff-1:s-1']);
  const userRepository = {
    model: {
      sequelize: {
        async query(sql, { replacements }) {
          void sql;
          return [
            replacements.adminUserId === 'admin-1' && replacements.stationId === 's-1' ? [{}] : [],
          ];
        },
      },
    },
  };
  return new AccessControlService({
    userRepository,
    adminJourneyRepository: {
      async findActive(a, j) {
        return journeys.has(`${a}:${j}`) ? {} : null;
      },
    },
    journeyRepository: { async findById(id) { return id === 'j-1' ? { trainId: 't-1' } : { trainId: 't-2' }; } },
    adminTrainAssignmentRepository: { async isAdminAssignedToTrain(adminId, trainId) { return adminId === 'admin-1' && trainId === 't-1'; } },
    staffStationRepository: {
      async findActive(s, station) {
        return stations.has(`${s}:${station}`) ? {} : null;
      },
    },
  });
}
test('enforces creation hierarchy', () => {
  const service = fixture();
  assert.equal(service.canCreateUser({ role: 'SUPER_ADMIN' }, 'ADMIN'), true);
  assert.equal(service.canCreateUser({ role: 'ADMIN' }, 'STAFF'), true);
  assert.equal(service.canCreateUser({ role: 'ADMIN' }, 'ADMIN'), false);
  assert.equal(service.canCreateUser({ role: 'STAFF' }, 'STAFF'), false);
});
test('enforces journey and station scopes with super-admin bypass', async () => {
  const service = fixture();
  await service.assertAdminJourneyAccess({
    actor: { id: 'admin-1', role: 'ADMIN' },
    journeyId: 'j-1',
  });
  await assert.rejects(
    () =>
      service.assertAdminJourneyAccess({
        actor: { id: 'admin-1', role: 'ADMIN' },
        journeyId: 'j-2',
      }),
    AuthorizationError
  );
  await service.assertStaffStationAccess({
    actor: { id: 'staff-1', role: 'STAFF' },
    stationId: 's-1',
  });
  await assert.rejects(
    () =>
      service.assertStaffStationAccess({
        actor: { id: 'staff-1', role: 'STAFF' },
        stationId: 's-2',
      }),
    AuthorizationError
  );
  await service.assertAdminJourneyAccess({ actor: { role: 'SUPER_ADMIN' }, journeyId: 'anything' });
});
