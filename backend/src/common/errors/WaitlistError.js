'use strict';
const AppError = require('./AppError');
class WaitlistError extends AppError {
  constructor(message = 'Waitlist operation failed', details, options) {
    super(message, 422, 'WAITLIST_ERROR', details, options);
  }
}
module.exports = WaitlistError;
