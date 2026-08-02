'use strict';
const PaymentError = require('./PaymentError');
class ReconciliationError extends PaymentError {
  constructor(message = 'Payment reconciliation failed') {
    super(message);
    this.code = 'RECONCILIATION_ERROR';
  }
}
module.exports = ReconciliationError;
