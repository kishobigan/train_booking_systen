'use strict';
const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');
class FareRuleNotFoundError extends AppError {
  constructor(message = 'No applicable fare rule was found', details, options = {}) {
    super(message, 422, ERROR_CODES.FARE_RULE_NOT_FOUND, details, options);
  }
}
module.exports = FareRuleNotFoundError;
