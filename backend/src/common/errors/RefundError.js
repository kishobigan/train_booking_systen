'use strict';
const AppError = require('./AppError');
class RefundError extends AppError {
  constructor(message = 'Refund operation failed', details, options) {
    super(message, 422, 'REFUND_ERROR', details, options);
  }
}
module.exports = RefundError;
