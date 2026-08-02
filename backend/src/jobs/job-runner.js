'use strict';
const os = require('node:os');
const crypto = require('node:crypto');
const STATUS = require('../common/constants/job-status.constants');
class JobRunner {
  constructor({
    jobLockService,
    jobExecutionRepository,
    logger = console,
    workerId = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`,
  }) {
    Object.assign(this, { jobLockService, jobExecutionRepository, logger, workerId });
    this.active = new Set();
  }
  async run({ jobName, handler, metadata }) {
    const started = Date.now();
    let lease;
    let execution;
    try {
      lease = await this.jobLockService.tryAcquire(jobName);
      if (!lease) {
        await this.jobExecutionRepository.recordSkipped({
          jobName,
          workerId: this.workerId,
          metadata,
        });
        this.logger.info?.(
          { jobName, workerId: this.workerId },
          'Job skipped because lock is held'
        );
        return { status: STATUS.SKIPPED_LOCKED };
      }
      execution = await this.jobExecutionRepository.createStarted({
        jobName,
        workerId: this.workerId,
        metadata,
      });
      const promise = Promise.resolve().then(handler);
      this.active.add(promise);
      let result;
      try {
        result = normalize(await promise);
      } finally {
        this.active.delete(promise);
      }
      const status = result.failed > 0 ? STATUS.COMPLETED_WITH_ERRORS : STATUS.COMPLETED;
      await this.jobExecutionRepository.complete(execution, result, status);
      this.logger.info?.(
        {
          jobName,
          executionId: execution.id,
          status,
          durationMs: Date.now() - started,
          counts: result,
        },
        'Job completed'
      );
      return { status, ...result };
    } catch (error) {
      if (execution)
        await this.jobExecutionRepository.fail(execution, error).catch(() => undefined);
      this.logger.error?.(
        { jobName, executionId: execution?.id, code: error.code, err: error },
        'Job failed'
      );
      throw error;
    } finally {
      if (lease) await this.jobLockService.release(lease);
    }
  }
  waitForActive() {
    return Promise.allSettled([...this.active]);
  }
}
function normalize(value = {}) {
  return {
    found: Number(value.found ?? value.selected ?? 0),
    processed: Number(value.processed ?? 0),
    succeeded: Number(value.succeeded ?? value.processed ?? 0),
    failed: Number(value.failed ?? 0),
    skipped: Number(value.skipped ?? 0),
    metadata: value.metadata,
  };
}
module.exports = JobRunner;
