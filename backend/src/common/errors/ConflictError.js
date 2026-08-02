'use strict';

const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = undefined, options = {}) {
    super(message, 409, ERROR_CODES.CONFLICT, details, options);
  }
}

module.exports = ConflictError;
