'use strict';

const WRITABLE_FIELDS = Object.freeze([
  'coachId',
  'seatNumber',
  'rowNumber',
  'columnNumber',
  'seatType',
  'isWindow',
  'isAisle',
  'isAccessible',
  'isActive',
]);

function normalizeSeatInput(input = {}) {
  const values = Object.fromEntries(
    WRITABLE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
      field,
      input[field],
    ])
  );
  if (typeof values.seatNumber === 'string') {
    values.seatNumber = values.seatNumber.trim().toUpperCase();
  }
  if (typeof values.seatType === 'string') values.seatType = values.seatType.trim().toUpperCase();
  return values;
}

module.exports = { WRITABLE_FIELDS, normalizeSeatInput };
