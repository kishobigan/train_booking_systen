'use strict';
const PaymentError = require('./PaymentError');
class PaymentAmountMismatchError extends PaymentError {
  constructor() {
    super('Payment amount does not match the booking total');
    this.code = 'PAYMENT_AMOUNT_MISMATCH';
  }
}
module.exports = PaymentAmountMismatchError;
