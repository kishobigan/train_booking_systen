'use strict';

const WRITABLE_FIELDS = Object.freeze([
  'trainId',
  'coachNumber',
  'coachClass',
  'reservationType',
  'positionNumber',
  'totalSeats',
  'seatLayout',
  'isActive',
]);

function normalizeCoachInput(input = {}) {
  const values = Object.fromEntries(
    WRITABLE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
      field,
      input[field],
    ])
  );
  if (typeof values.coachNumber === 'string') {
    values.coachNumber = values.coachNumber.trim().toUpperCase();
  }
  return values;
}

module.exports = { WRITABLE_FIELDS, normalizeCoachInput };
