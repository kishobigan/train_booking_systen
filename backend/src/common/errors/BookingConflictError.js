'use strict';

const ConflictError = require('./ConflictError');
const ERROR_CODES = require('../constants/error-codes.constants');

class BookingConflictError extends ConflictError {
  constructor(
    message = 'The booking conflicts with an existing reservation',
    details = undefined,
    options = {}
  ) {
    super(message, details, options);
    this.code = ERROR_CODES.BOOKING_CONFLICT;
  }
}

module.exports = BookingConflictError;
