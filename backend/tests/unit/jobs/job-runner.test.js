'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const JobRunner = require('../../../src/jobs/job-runner');
const STATUS = require('../../../src/common/constants/job-status.constants');
function setup(acquired = true) {
  const calls = [];
  const lease = acquired ? {} : null;
  const lock = {
    tryAcquire: async () => {
      calls.push('lock');
      return lease;
    },
    release: async () => calls.push('release'),
  };
  const repo = {
    recordSkipped: async () => calls.push('skipped'),
    createStarted: async () => ({ id: 'execution' }),
    complete: async (_e, _r, s) => calls.push(s),
    fail: async () => calls.push('failed'),
  };
  return {
    calls,
    runner: new JobRunner({
      jobLockService: lock,
      jobExecutionRepository: repo,
      logger: { info() {}, error() {} },
      workerId: 'worker',
    }),
  };
}
test('runner locks, completes, and releases', async () => {
  const { runner, calls } = setup();
  const result = await runner.run({
    jobName: 'TEST',
    handler: async () => ({ found: 1, processed: 1, succeeded: 1 }),
  });
  assert.equal(result.status, STATUS.COMPLETED);
  assert.deepEqual(calls, ['lock', STATUS.COMPLETED, 'release']);
});
test('runner records lock skip', async () => {
  const { runner, calls } = setup(false);
  assert.equal(
    (await runner.run({ jobName: 'TEST', handler: async () => {} })).status,
    STATUS.SKIPPED_LOCKED
  );
  assert.deepEqual(calls, ['lock', 'skipped']);
});
test('runner releases after fatal failure', async () => {
  const { runner, calls } = setup();
  await assert.rejects(
    runner.run({
      jobName: 'TEST',
      handler: async () => {
        throw new Error('boom');
      },
    })
  );
  assert.deepEqual(calls, ['lock', 'failed', 'release']);
});
test('runner marks record errors', async () => {
  const { runner, calls } = setup();
  assert.equal(
    (
      await runner.run({
        jobName: 'TEST',
        handler: async () => ({ processed: 2, succeeded: 1, failed: 1 }),
      })
    ).status,
    STATUS.COMPLETED_WITH_ERRORS
  );
  assert.ok(calls.includes(STATUS.COMPLETED_WITH_ERRORS));
});
