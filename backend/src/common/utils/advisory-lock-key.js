'use strict';
const { createHash } = require('node:crypto');
function createAdvisoryLockKey(journeyId, seatId) {
  if (!journeyId || !seatId) throw new TypeError('journeyId and seatId are required');
  const digest = createHash('sha256').update(`${journeyId}:${seatId}`).digest();
  return digest.readBigInt64BE(0).toString();
}
module.exports = createAdvisoryLockKey;
