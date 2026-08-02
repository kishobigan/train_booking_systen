'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Job = require('../../../src/jobs/retry-notifications.job');
test('claims then dispatches due notifications with worker lease', async () => {
  const calls = [];
  const job = new Job({
    notificationRepository: {
      claimDueNotifications: async (input) => {
        calls.push(['claim', input.workerId]);
        return ['n1', 'n2'];
      },
    },
    notificationService: {
      sendNotification: async (input) => calls.push(['send', input.notificationId, input.workerId]),
    },
    transactionManager: { execute: (fn) => fn({}) },
    config: { batchSize: 10, concurrency: 2, maxRecordFailures: 5 },
    workerId: 'worker',
    logger: { error() {} },
  });
  const result = await job.execute();
  assert.equal(result.succeeded, 2);
  assert.deepEqual(calls[0], ['claim', 'worker']);
  assert.ok(calls.some((x) => x[0] === 'send' && x[2] === 'worker'));
});
