'use strict';
const WaitlistError = require('./WaitlistError');
class WaitlistOfferUnavailableError extends WaitlistError {
  constructor(message = 'The offered seat is no longer available') {
    super(message);
    this.code = 'WAITLIST_OFFER_UNAVAILABLE';
  }
}
module.exports = WaitlistOfferUnavailableError;
