'use strict';
const ValidationError = require('../../common/errors/ValidationError');
function validateCreate(input) {
  if (!input.fullName || !input.email) throw new ValidationError('fullName and email are required');
  if (!Array.isArray(input.journeyIds) || !Array.isArray(input.stationIds))
    throw new ValidationError('Assignments must be arrays');
  return input;
}
module.exports = { validateCreate };
