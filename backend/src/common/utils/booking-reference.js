'use strict';
const { randomBytes } = require('node:crypto');
function createBookingReference(date = new Date()) {
  void date;
  return `TRN-${randomBytes(5).toString('base64url').slice(0, 6).toUpperCase()}`;
}
module.exports = createBookingReference;
