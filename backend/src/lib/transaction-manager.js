'use strict';
const { Transaction } = require('sequelize');
const sequelize = require('../database/sequelize');
const TransactionRetryError = require('../common/errors/TransactionRetryError');
const { isTransientTransactionError } = require('../common/utils/database-error');

class TransactionManager {
  constructor(
    connection = sequelize,
    { maxRetries = Number(process.env.TRANSACTION_MAX_RETRIES || 3) } = {}
  ) {
    this.sequelize = connection;
    this.maxRetries = maxRetries;
  }
  /** Execute one managed transaction using the requested options. */
  execute(callback, options = {}) {
    return this.sequelize.transaction(options, callback);
  }
  /** Execute at SERIALIZABLE isolation and retry only transient PostgreSQL failures. */
  async executeSerializable(callback, options = {}) {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.execute(callback, {
          ...options,
          isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
        });
      } catch (error) {
        if (!isTransientTransactionError(error)) throw error;
        if (attempt === maxRetries)
          throw new TransactionRetryError(undefined, { attempts: attempt + 1 }, { cause: error });
      }
    }
    throw new TransactionRetryError();
  }
}
module.exports = TransactionManager;
