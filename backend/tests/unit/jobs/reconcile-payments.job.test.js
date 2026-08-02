'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Job = require('../../../src/jobs/reconcile-payments.job');
test('reconciliation uses bounded candidates and domain service', async () => {
  let options;
  const called = [];
  const job = new Job({
    paymentRepository: {
      findReconciliationCandidates: async (value) => {
        options = value;
        return [{ id: 'p1' }, { id: 'p2' }];
      },
    },
    paymentReconciliationService: {
      reconcilePayment: async ({ payment }) => called.push(payment.id),
    },
    config: {
      batchSize: 2,
      maxPerRun: 3,
      minAgeMinutes: 5,
      maxAgeDays: 30,
      concurrency: 2,
      maxRecordFailures: 5,
    },
    logger: { error() {} },
  });
  const result = await job.execute();
  assert.equal(options.limit, 2);
  assert.equal(result.succeeded, 2);
  assert.deepEqual(called.sort(), ['p1', 'p2']);
});
test('reconciliation continues after provider failure', async () => {
  const job = new Job({
    paymentRepository: { findReconciliationCandidates: async () => [{ id: 'p1' }, { id: 'p2' }] },
    paymentReconciliationService: {
      reconcilePayment: async ({ payment }) => {
        if (payment.id === 'p1') throw new Error('provider');
      },
    },
    config: {
      batchSize: 2,
      maxPerRun: 2,
      minAgeMinutes: 5,
      maxAgeDays: 30,
      concurrency: 1,
      maxRecordFailures: 5,
    },
    logger: { error() {} },
  });
  const result = await job.execute();
  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 1);
});
