'use strict';

const FIELDS = Object.freeze([
  'journeyId',
  'originJourneyStationId',
  'destinationJourneyStationId',
  'journeySeatId',
  'coachClass',
  'passengers',
]);

function fareQuoteDto(input = {}) {
  return Object.fromEntries(
    FIELDS.filter((field) => input[field] !== undefined).map((field) => [field, input[field]])
  );
}

module.exports = { FIELDS, fareQuoteDto };
