'use strict';
const AppError = require('./AppError');
const ERROR_CODES = require('../constants/error-codes.constants');
class InvalidJourneySegmentError extends AppError {
  constructor(message = 'The journey segment is invalid', details, options = {}) {
    super(message, 400, ERROR_CODES.INVALID_JOURNEY_SEGMENT, details, options);
  }
}
module.exports = InvalidJourneySegmentError;
