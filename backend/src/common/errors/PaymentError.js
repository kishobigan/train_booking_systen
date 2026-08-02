'use strict';
const AppError = require('./AppError');
class PaymentError extends AppError {
  constructor(message = 'Payment operation failed', details, options) {
    super(message, 422, 'PAYMENT_ERROR', details, options);
  }
}
module.exports = PaymentError;
