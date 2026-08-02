'use strict';
class JobError extends Error {
  constructor({
    code = 'JOB_ERROR',
    message = 'Background job failed',
    retryable = false,
    cause = null,
  } = {}) {
    super(message, { cause });
    this.name = 'JobError';
    this.code = code;
    this.retryable = retryable;
  }
}
module.exports = JobError;
