'use strict';
const PaymentError = require('./PaymentError');
class BankSlipError extends PaymentError {
  constructor(message = 'Invalid bank slip') {
    super(message);
    this.code = 'BANK_SLIP_ERROR';
  }
}
module.exports = BankSlipError;
