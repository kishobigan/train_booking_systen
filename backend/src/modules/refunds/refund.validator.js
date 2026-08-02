'use strict';
const ValidationError = require('../../common/errors/ValidationError');
function validateRefund(input) {
  if (!input.reason?.trim()) throw new ValidationError('Refund reason is required');
  if (input.requestedAmount !== undefined && Number(input.requestedAmount) <= 0)
    throw new ValidationError('Refund amount must be positive');
  return input;
}
module.exports = { validateRefund };
