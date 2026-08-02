'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const { UUID } = require('../fares/fare.validator');
const COACH_CLASS = require('../../common/constants/coach-class.constants');
function validateAvailabilityInput(input) {
  for (const field of ['journeyId', 'originJourneyStationId', 'destinationJourneyStationId']) {
    if (!UUID.test(input[field] || '')) throw new ValidationError(`${field} must be a valid UUID`);
  }
  if (!Number.isInteger(input.page) || input.page < 1)
    throw new ValidationError('page must be a positive integer');
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
    throw new ValidationError('limit must be between 1 and 100');
  if (input.coachClass && !Object.values(COACH_CLASS).includes(input.coachClass))
    throw new ValidationError('Unsupported coachClass');
  return input;
}
module.exports = { validateAvailabilityInput };
