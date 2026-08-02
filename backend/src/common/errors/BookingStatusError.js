'use strict';
const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');
class BookingStatusError extends AppError {
  constructor(message = 'Invalid booking status transition', details, options = {}) {
    super(message, 409, ERROR_CODES.INVALID_BOOKING_STATUS_TRANSITION, details, options);
  }
}
module.exports = BookingStatusError;
