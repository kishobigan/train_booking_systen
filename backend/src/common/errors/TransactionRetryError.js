'use strict';
const AppError = require('./AppError');
class TransactionRetryError extends AppError {
  constructor(
    message = 'The operation could not be completed after transaction retries',
    details,
    options = {}
  ) {
    super(message, 503, 'TRANSACTION_RETRY_EXHAUSTED', details, options);
  }
}
module.exports = TransactionRetryError;
