'use strict';
const PaymentError = require('./PaymentError');
class PaymentAlreadyProcessedError extends PaymentError {
  constructor() {
    super('Payment has already been processed');
    this.code = 'PAYMENT_ALREADY_PROCESSED';
  }
}
module.exports = PaymentAlreadyProcessedError;
