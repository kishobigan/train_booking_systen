'use strict';

const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = undefined, options = {}) {
    super(message, 404, ERROR_CODES.NOT_FOUND, details, options);
  }
}

module.exports = NotFoundError;
