'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const password = require('../../lib/password');
function validateLogin(input) {
  if (
    typeof input.identifier !== 'string' ||
    !input.identifier.trim() ||
    input.identifier.length > 254
  )
    throw new ValidationError('identifier is required and must not exceed 254 characters');
  if (typeof input.password !== 'string' || !input.password || input.password.length > 128)
    throw new ValidationError('password is required and must not exceed 128 characters');
  return input;
}
function validatePasswordChange(input) {
  if (
    typeof input.currentPassword !== 'string' ||
    !input.currentPassword ||
    input.currentPassword.length > 128
  )
    throw new ValidationError('currentPassword is required');
  if (typeof input.newPassword !== 'string' || input.newPassword.length > 128)
    throw new ValidationError('newPassword is required and must not exceed 128 characters');
  if (typeof input.confirmPassword !== 'string' || !input.confirmPassword)
    throw new ValidationError('confirmPassword is required');
  if (input.newPassword !== input.confirmPassword)
    throw new ValidationError('Password confirmation does not match');
  password.validatePassword(input.newPassword);
  return input;
}
module.exports = { validateLogin, validatePasswordChange };
