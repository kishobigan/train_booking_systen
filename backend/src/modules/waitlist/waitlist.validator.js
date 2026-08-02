'use strict';

const ValidationError = require('../../common/errors/ValidationError');
const COACH_CLASS = require('../../common/constants/coach-class.constants');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value, field) {
  if (!UUID.test(value || '')) throw new ValidationError(`${field} must be a valid UUID`);
}
function validateJoin(input) {
  uuid(input.journeyId, 'journeyId');
  uuid(input.originJourneyStationId, 'originJourneyStationId');
  uuid(input.destinationJourneyStationId, 'destinationJourneyStationId');
  if (!Object.values(COACH_CLASS).includes(input.requestedCoachClass))
    throw new ValidationError('requestedCoachClass is invalid');
  if (!Number.isInteger(input.passengerCount))
    throw new ValidationError('passengerCount must be an integer');
  return input;
}
function validateAccept(input) {
  if (!Array.isArray(input.passengers) || !input.passengers.length)
    throw new ValidationError('passengers must be a non-empty array');
  if (!input.contact || typeof input.contact !== 'object')
    throw new ValidationError('contact is required');
  return input;
}
function validateOffer(input) {
  const ids = input.journeySeatIds || [input.journeySeatId].filter(Boolean);
  if (!ids.length) throw new ValidationError('At least one journey seat is required');
  ids.forEach((id) => uuid(id, 'journeySeatId'));
  return { ...input, journeySeatIds: ids };
}

module.exports = { validateJoin, validateAccept, validateOffer, uuid };
