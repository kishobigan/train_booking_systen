'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const METHODS = require('../../common/constants/payment-method.constants');
function validateCreatePayment(input) {
  if (!input.bookingId) throw new ValidationError('bookingId is required');
  if (![METHODS.CARD, METHODS.BANK_SLIP].includes(input.method))
    throw new ValidationError('method must be CARD or BANK_SLIP');
  return input;
}
module.exports = { validateCreatePayment };
