'use strict';
const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');
class SeatUnavailableError extends AppError {
  constructor(message = 'One or more selected seats are unavailable', details, options = {}) {
    super(message, 409, ERROR_CODES.SEAT_UNAVAILABLE, details, options);
  }
}
module.exports = SeatUnavailableError;
