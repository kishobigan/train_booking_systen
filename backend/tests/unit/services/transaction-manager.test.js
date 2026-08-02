'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const TransactionManager = require('../../../src/lib/transaction-manager');
const TransactionRetryError = require('../../../src/common/errors/TransactionRetryError');

test('retries serialization failures and preserves serializable isolation', async () => {
  let attempts = 0;
  const manager = new TransactionManager(
    {
      async transaction(options, callback) {
        attempts += 1;
        assert.equal(options.isolationLevel, 'SERIALIZABLE');
        if (attempts < 3) throw Object.assign(new Error('retry'), { code: '40001' });
        return callback({ id: 'tx' });
      },
    },
    { maxRetries: 3 }
  );
  assert.equal(await manager.executeSerializable(async () => 'ok'), 'ok');
  assert.equal(attempts, 3);
});
test('does not retry operational errors and controls retry exhaustion', async () => {
  const manager = new TransactionManager(
    {
      async transaction() {
        throw Object.assign(new Error('deadlock'), { code: '40P01' });
      },
    },
    { maxRetries: 1 }
  );
  await assert.rejects(() => manager.executeSerializable(async () => null), TransactionRetryError);
  let attempts = 0;
  const nonTransient = new TransactionManager({
    async transaction() {
      attempts += 1;
      throw new ValidationError('invalid');
    },
  });
  const ValidationError = require('../../../src/common/errors/ValidationError');
  await assert.rejects(() => nonTransient.executeSerializable(async () => null), ValidationError);
  assert.equal(attempts, 1);
});
