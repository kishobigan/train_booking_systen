'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const PASSENGER_TYPE = require('../../common/constants/passenger-type.constants');
const COACH_CLASS = require('../../common/constants/coach-class.constants');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateFareQuoteInput(input, maximumPassengers = 6) {
  for (const field of ['journeyId', 'originJourneyStationId', 'destinationJourneyStationId']) {
    if (!UUID.test(input[field] || '')) throw new ValidationError(`${field} must be a valid UUID`);
  }
  if (input.journeySeatId && !UUID.test(input.journeySeatId)) {
    throw new ValidationError('journeySeatId must be a valid UUID');
  }
  if (!input.journeySeatId && !input.coachClass) {
    throw new ValidationError('Either journeySeatId or coachClass is required');
  }
  if (input.coachClass && !Object.values(COACH_CLASS).includes(input.coachClass)) {
    throw new ValidationError('Unsupported coachClass');
  }
  if (!Array.isArray(input.passengers) || input.passengers.length < 1) {
    throw new ValidationError('At least one passenger is required');
  }
  if (input.passengers.length > maximumPassengers) {
    throw new ValidationError(`A maximum of ${maximumPassengers} passengers is allowed`);
  }
  for (const passenger of input.passengers) {
    if (!Object.values(PASSENGER_TYPE).includes(passenger?.passengerType)) {
      throw new ValidationError('Unsupported passengerType');
    }
  }
  return input;
}

module.exports = { UUID, validateFareQuoteInput };
