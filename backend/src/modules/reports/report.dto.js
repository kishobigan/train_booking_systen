'use strict';
const Decimal = require('decimal.js');
const decimal = (value) => new Decimal(value || 0).toFixed(2);
const subtract = (left, right) => new Decimal(left || 0).minus(right || 0).toFixed(2);
module.exports = { decimal, subtract };
