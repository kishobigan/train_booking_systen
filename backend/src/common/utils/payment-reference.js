'use strict';
const { randomBytes } = require('node:crypto');
const reference = (prefix) =>
  `${prefix}-${randomBytes(6)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase()
    .padEnd(8, 'X')}`;
module.exports = {
  generatePaymentReference: () => reference('PAY'),
  generateRefundReference: () => reference('REF'),
};
