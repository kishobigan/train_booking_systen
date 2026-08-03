'use strict';
module.exports = Object.freeze({
  secret: process.env.GUEST_BOOKING_TOKEN_SECRET || 'development-guest-booking-secret',
  ttlSeconds: Number(process.env.GUEST_BOOKING_TOKEN_TTL_SECONDS || 86400),
  cookieName: process.env.GUEST_BOOKING_COOKIE_NAME || 'guest_booking_access',
});
