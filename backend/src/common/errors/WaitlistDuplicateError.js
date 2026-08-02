'use strict';
const AppError = require('./AppError');
class WaitlistDuplicateError extends AppError {
  constructor() {
    super(
      'An active waitlist entry already exists for this journey segment and coach class',
      409,
      'WAITLIST_DUPLICATE'
    );
  }
}
module.exports = WaitlistDuplicateError;
