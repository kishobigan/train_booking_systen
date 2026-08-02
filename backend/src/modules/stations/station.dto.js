'use strict';

const WRITABLE_FIELDS = Object.freeze([
  'code',
  'name',
  'localName',
  'city',
  'district',
  'latitude',
  'longitude',
  'platformCount',
  'isActive',
]);

function pickStationFields(input = {}) {
  return Object.fromEntries(
    WRITABLE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
      field,
      input[field],
    ])
  );
}

function normalizeStationInput(input = {}) {
  const values = pickStationFields(input);
  if (typeof values.code === 'string') values.code = values.code.trim().toUpperCase();
  for (const field of ['name', 'localName', 'city', 'district']) {
    if (typeof values[field] === 'string') values[field] = values[field].trim();
  }
  return values;
}

module.exports = { WRITABLE_FIELDS, normalizeStationInput, pickStationFields };
