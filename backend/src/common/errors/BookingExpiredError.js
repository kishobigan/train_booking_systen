'use strict';
const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');
class BookingExpiredError extends AppError {
  constructor(message = 'The booking hold has expired', details, options = {}) {
    super(message, 409, ERROR_CODES.BOOKING_HOLD_EXPIRED, details, options);
  }
}
module.exports = BookingExpiredError;
