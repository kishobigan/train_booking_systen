'use strict';
module.exports = Object.freeze({
  enabled: process.env.WAITLIST_ENABLED !== 'false',
  offerMinutes: Number(process.env.WAITLIST_OFFER_MINUTES || 15),
  maxPassengersPerEntry: Number(process.env.WAITLIST_MAX_PASSENGERS || 6),
  requeueExpiredOffers: process.env.WAITLIST_REQUEUE_EXPIRED === 'true',
  candidateBatchSize: Math.min(
    Math.max(Number(process.env.WAITLIST_CANDIDATE_BATCH_SIZE || 50), 1),
    100
  ),
});
