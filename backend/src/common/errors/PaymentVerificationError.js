'use strict';
const PaymentError = require('./PaymentError');
class PaymentVerificationError extends PaymentError {
  constructor(message = 'Payment verification failed') {
    super(message);
    this.code = 'PAYMENT_VERIFICATION_FAILED';
  }
}
module.exports = PaymentVerificationError;
