'use strict';
const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const ValidationError = require('../common/errors/ValidationError');
const scrypt = promisify(scryptCallback);
function validatePassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  )
    throw new ValidationError(
      'Password must be at least 12 characters and include uppercase, lowercase, number, and special characters'
    );
  return password;
}
async function hash(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}
async function verify(password, encoded) {
  try {
    const [, salt, value] = encoded.split('$');
    const derived = await scrypt(password, salt, 64);
    return timingSafeEqual(Buffer.from(value, 'hex'), derived);
  } catch {
    return false;
  }
}
module.exports = { hash, verify, validatePassword };
