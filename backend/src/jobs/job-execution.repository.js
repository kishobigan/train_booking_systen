'use strict';
const STATUS = require('../common/constants/job-status.constants');
class JobExecutionRepository {
  constructor({ JobExecution }) {
    this.model = JobExecution;
  }
  createStarted({ jobName, workerId, metadata }) {
    return this.model.create({
      jobName,
      workerId,
      status: STATUS.STARTED,
      metadata: sanitize(metadata),
    });
  }
  recordSkipped({ jobName, workerId, metadata }) {
    return this.model.create({
      jobName,
      workerId,
      status: STATUS.SKIPPED_LOCKED,
      finishedAt: new Date(),
      metadata: sanitize(metadata),
    });
  }
  complete(execution, result, status) {
    return execution.update({
      status,
      finishedAt: new Date(),
      recordsFound: result.found || 0,
      recordsProcessed: result.processed || 0,
      recordsSucceeded: result.succeeded || 0,
      recordsFailed: result.failed || 0,
      metadata: sanitize({
        ...execution.metadata,
        ...result.metadata,
        skipped: result.skipped || 0,
      }),
    });
  }
  fail(execution, error) {
    return execution.update({
      status: STATUS.FAILED,
      finishedAt: new Date(),
      errorCode: safeCode(error),
      errorMessage: 'Background job execution failed.',
    });
  }
  async lastSuccessfulRuns() {
    const rows = await this.model.findAll({
      where: { status: STATUS.COMPLETED },
      order: [['finishedAt', 'DESC']],
      limit: 50,
    });
    return Object.fromEntries(rows.map((r) => [r.jobName, r.finishedAt]));
  }
}
const safeCode = (e) => String(e?.code || e?.name || 'JOB_FAILED').slice(0, 100);
const sanitize = (value) =>
  value
    ? JSON.parse(
        JSON.stringify(value, (key, item) =>
          /token|secret|password|payload|content/i.test(key) ? undefined : item
        )
      )
    : null;
module.exports = JobExecutionRepository;
