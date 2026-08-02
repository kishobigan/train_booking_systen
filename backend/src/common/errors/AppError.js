'use strict';

const ERROR_CODES = require('../constants/error-codes.constants');

class AppError extends Error {
  constructor(
    message = 'An unexpected error occurred',
    statusCode = 500,
    code = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details = undefined,
    options = {}
  ) {
    super(message, options);

    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace?.(this, new.target);
  }
}

module.exports = AppError;
