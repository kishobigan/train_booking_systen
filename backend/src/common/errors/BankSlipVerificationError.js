'use strict';
const BankSlipError = require('./BankSlipError');
class BankSlipVerificationError extends BankSlipError {
  constructor(message = 'Bank slip verification failed') {
    super(message);
    this.code = 'BANK_SLIP_VERIFICATION_FAILED';
  }
}
module.exports = BankSlipVerificationError;
