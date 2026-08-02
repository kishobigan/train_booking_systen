'use strict';

const Decimal = require('decimal.js');

Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });

function toDecimal(value, field = 'amount') {
  try {
    const decimal = new Decimal(value ?? 0);
    if (!decimal.isFinite()) throw new Error();
    return decimal;
  } catch {
    throw new TypeError(`${field} must be a valid decimal`);
  }
}

const add = (...values) =>
  values.reduce((total, value) => total.plus(toDecimal(value)), new Decimal(0));
const subtract = (left, right) => toDecimal(left).minus(toDecimal(right));
const multiply = (left, right) => toDecimal(left).times(toDecimal(right));
const divide = (left, right) => toDecimal(left).dividedBy(toDecimal(right));
const percentage = (amount, rate) => multiply(amount, rate).dividedBy(100);
const maximum = (left, right) => Decimal.max(toDecimal(left), toDecimal(right));
const roundCurrency = (value) => toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const formatAmount = (value) => roundCurrency(value).toFixed(2);
const formatDecimal = (value, scale) => toDecimal(value).toFixed(scale);

module.exports = {
  Decimal,
  toDecimal,
  add,
  subtract,
  multiply,
  divide,
  percentage,
  maximum,
  roundCurrency,
  formatAmount,
  formatDecimal,
};
