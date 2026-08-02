'use strict';

const WRITABLE_FIELDS = Object.freeze(['trainNumber', 'name', 'description', 'isActive']);

function normalizeTrainInput(input = {}) {
  const values = Object.fromEntries(
    WRITABLE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
      field,
      input[field],
    ])
  );
  if (typeof values.trainNumber === 'string') {
    values.trainNumber = values.trainNumber.trim().toUpperCase();
  }
  for (const field of ['name', 'description']) {
    if (typeof values[field] === 'string') values[field] = values[field].trim();
  }
  return values;
}

module.exports = { WRITABLE_FIELDS, normalizeTrainInput };
