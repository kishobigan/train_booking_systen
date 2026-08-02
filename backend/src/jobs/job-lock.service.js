'use strict';
const crypto = require('node:crypto');
const JobLockError = require('../common/errors/JobLockError');
class JobLockService {
  constructor({ sequelize, logger = console }) {
    this.sequelize = sequelize;
    this.logger = logger;
    this.active = new Set();
  }
  lockKey(jobName) {
    const bytes = crypto
      .createHash('sha256')
      .update(`train-booking-job:${jobName}`)
      .digest()
      .subarray(0, 8);
    return BigInt.asIntN(64, bytes.readBigUInt64BE()).toString();
  }
  async tryAcquire(jobName) {
    const connection = await this.sequelize.connectionManager.getConnection({ type: 'write' });
    const key = this.lockKey(jobName);
    try {
      const result = await connection.query('SELECT pg_try_advisory_lock($1::bigint) AS acquired', [
        key,
      ]);
      if (!result.rows[0].acquired) {
        await this.sequelize.connectionManager.releaseConnection(connection);
        return null;
      }
      const lease = { jobName, key, connection, released: false };
      this.active.add(lease);
      return lease;
    } catch (error) {
      await this.sequelize.connectionManager.releaseConnection(connection);
      throw new JobLockError(undefined, { cause: error });
    }
  }
  async release(lease) {
    if (!lease || lease.released) return false;
    try {
      await lease.connection.query('SELECT pg_advisory_unlock($1::bigint)', [lease.key]);
      return true;
    } catch (error) {
      this.logger.error?.(
        { jobName: lease.jobName, code: error.code },
        'Failed to release job lock'
      );
      throw new JobLockError(undefined, { cause: error });
    } finally {
      lease.released = true;
      this.active.delete(lease);
      await this.sequelize.connectionManager.releaseConnection(lease.connection);
    }
  }
  async releaseAll() {
    await Promise.allSettled([...this.active].map((lease) => this.release(lease)));
  }
}
module.exports = JobLockService;
