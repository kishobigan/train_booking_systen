'use strict';

const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = undefined, options = {}) {
    super(message, 401, ERROR_CODES.AUTHENTICATION_REQUIRED, details, options);
  }
}

module.exports = AuthenticationError;
