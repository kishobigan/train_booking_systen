'use strict';

const SERVICE_FEE_TYPES = Object.freeze([
  'FIXED_PER_BOOKING',
  'FIXED_PER_PASSENGER',
  'PERCENTAGE',
  'NONE',
]);

function nonNegativeDecimal(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`${name} must be a non-negative decimal`);
  return value;
}

function boolean(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!['true', 'false'].includes(value.toLowerCase()))
    throw new Error(`${name} must be true or false`);
  return value.toLowerCase() === 'true';
}

const serviceFeeType = process.env.SERVICE_FEE_TYPE || 'NONE';
if (!SERVICE_FEE_TYPES.includes(serviceFeeType)) {
  throw new Error(`SERVICE_FEE_TYPE must be one of: ${SERVICE_FEE_TYPES.join(', ')}`);
}
const maximumPassengersPerBooking = Number(process.env.MAX_PASSENGERS_PER_BOOKING || 6);
if (!Number.isInteger(maximumPassengersPerBooking) || maximumPassengersPerBooking < 1) {
  throw new Error('MAX_PASSENGERS_PER_BOOKING must be a positive integer');
}

module.exports = Object.freeze({
  serviceFee: Object.freeze({
    type: serviceFeeType,
    value: nonNegativeDecimal('SERVICE_FEE_VALUE', '0'),
  }),
  tax: Object.freeze({
    enabled: boolean('FARE_TAX_ENABLED'),
    percentage: nonNegativeDecimal('FARE_TAX_PERCENTAGE', '0'),
    includesServiceFee: boolean('FARE_TAX_INCLUDES_SERVICE_FEE'),
  }),
  rounding: Object.freeze({ currencyScale: 2, mode: 'ROUND_HALF_UP' }),
  maximumPassengersPerBooking,
  SERVICE_FEE_TYPES,
});
