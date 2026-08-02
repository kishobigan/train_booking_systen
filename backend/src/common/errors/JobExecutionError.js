'use strict';
const JobError = require('./JobError');
class JobExecutionError extends JobError {
  constructor(
    message = 'Background job execution failed',
    { cause = null, retryable = false } = {}
  ) {
    super({ code: 'JOB_EXECUTION_ERROR', message, retryable, cause });
    this.name = 'JobExecutionError';
  }
}
module.exports = JobExecutionError;
