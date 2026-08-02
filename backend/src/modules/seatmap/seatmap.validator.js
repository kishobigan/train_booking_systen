'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateSeatMapRequest(input = {}) {
  for (const field of ['journeyId', 'originJourneyStationId', 'destinationJourneyStationId'])
    if (!UUID.test(input[field] || '')) throw new ValidationError(`${field} must be a valid UUID`);
  if (input.originJourneyStationId === input.destinationJourneyStationId)
    throw new ValidationError('Origin and destination must differ');
  if (input.lastKnownVersion != null && !/^\d+$/.test(String(input.lastKnownVersion)))
    throw new ValidationError('lastKnownVersion must be numeric');
  return {
    journeyId: input.journeyId,
    originJourneyStationId: input.originJourneyStationId,
    destinationJourneyStationId: input.destinationJourneyStationId,
    coachClass: input.coachClass,
    coachNumber: input.coachNumber,
    lastKnownVersion: input.lastKnownVersion,
  };
}
module.exports = { validateSeatMapRequest, UUID };
