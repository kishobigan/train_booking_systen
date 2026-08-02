'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const password = require('../../lib/password');
function validateLogin(input) {
  if (!input.identifier || !input.password)
    throw new ValidationError('identifier and password are required');
  return input;
}
function validatePasswordChange(input) {
  if (!input.currentPassword || !input.newPassword || !input.confirmPassword)
    throw new ValidationError('All password fields are required');
  password.validatePassword(input.newPassword);
  return input;
}
function validateRefresh(input) {
  if (!input.refreshToken) throw new ValidationError('refreshToken is required');
  return input;
}
module.exports = { validateLogin, validatePasswordChange, validateRefresh };
