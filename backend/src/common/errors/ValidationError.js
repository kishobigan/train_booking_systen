'use strict';

const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = undefined, options = {}) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR, details, options);
  }
}

module.exports = ValidationError;
