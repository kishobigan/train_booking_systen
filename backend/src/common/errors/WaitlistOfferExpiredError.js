'use strict';
const WaitlistError = require('./WaitlistError');
class WaitlistOfferExpiredError extends WaitlistError {
  constructor() {
    super('The waitlist seat offer has expired');
    this.code = 'WAITLIST_OFFER_EXPIRED';
  }
}
module.exports = WaitlistOfferExpiredError;
