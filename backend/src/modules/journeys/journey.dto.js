'use strict';

const WRITABLE_FIELDS = Object.freeze([
  'routeId',
  'trainId',
  'serviceNumber',
  'journeyDate',
  'scheduledDepartureAt',
  'scheduledArrivalAt',
  'actualDepartureAt',
  'actualArrivalAt',
  'status',
  'bookingOpensAt',
  'bookingClosesAt',
]);

function normalizeJourneyInput(input = {}) {
  const values = Object.fromEntries(
    WRITABLE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
      field,
      input[field],
    ])
  );
  if (typeof values.serviceNumber === 'string') {
    values.serviceNumber = values.serviceNumber.trim().toUpperCase();
  }
  return values;
}

module.exports = { WRITABLE_FIELDS, normalizeJourneyInput };
