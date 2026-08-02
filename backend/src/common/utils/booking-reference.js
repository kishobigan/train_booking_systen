'use strict';
const { randomBytes } = require('node:crypto');
function createBookingReference(date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  return `TRN-${day}-${randomBytes(4).toString('hex').toUpperCase()}`;
}
module.exports = createBookingReference;
