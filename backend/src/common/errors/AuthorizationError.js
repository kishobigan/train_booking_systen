'use strict';

const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');

class AuthorizationError extends AppError {
  constructor(
    message = 'You are not authorized to perform this action',
    details = undefined,
    options = {}
  ) {
    super(message, 403, ERROR_CODES.FORBIDDEN, details, options);
  }
}

module.exports = AuthorizationError;
