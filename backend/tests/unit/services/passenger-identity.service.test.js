'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PassengerIdentityService = require('../../../src/modules/bookings/passenger-identity.service');

const service = new PassengerIdentityService({
  hmacSecret: 'test-hmac-secret',
  encryptionKey: 'test-encryption-secret',
});

test('normalizes, encrypts and hashes official identities without retaining plaintext', () => {
  const first = service.prepare({ identityType: 'NIC', identityNumber: ' 2000-1234 5678 ' });
  const second = service.prepare({ identityType: 'NIC', identityNumber: '200012345678' });
  assert.equal(first.identityNumber, null);
  assert.equal(first.identityNumberHash, second.identityNumberHash);
  assert.notEqual(first.identityNumberEncrypted, second.identityNumberEncrypted);
  assert.equal(first.identityNumberLast4, '5678');
  assert.doesNotMatch(first.identityNumberEncrypted, /200012345678/);
});

test('dependent identity rejects an identity number', () => {
  assert.throws(
    () => service.prepare({ identityType: 'DEPENDENT', identityNumber: 'Dependent' }),
    /cannot have an identity number/
  );
});
