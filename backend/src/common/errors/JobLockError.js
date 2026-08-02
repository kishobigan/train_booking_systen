'use strict';
const JobError = require('./JobError');
class JobLockError extends JobError {
  constructor(message = 'Unable to manage the distributed job lock', { cause = null } = {}) {
    super({ code: 'JOB_LOCK_ERROR', message, retryable: true, cause });
    this.name = 'JobLockError';
  }
}
module.exports = JobLockError;
