'use strict';
const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');
class FareCalculationError extends AppError {
  constructor(message = 'The fare could not be calculated', details, options = {}) {
    super(message, 422, ERROR_CODES.FARE_CALCULATION_FAILED, details, options);
  }
}
module.exports = FareCalculationError;
