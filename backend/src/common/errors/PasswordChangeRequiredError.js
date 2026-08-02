'use strict';
const AuthorizationError = require('./AuthorizationError');
class PasswordChangeRequiredError extends AuthorizationError {
  constructor() {
    super('You must change your temporary password before continuing.');
    this.code = 'PASSWORD_CHANGE_REQUIRED';
  }
}
module.exports = PasswordChangeRequiredError;
