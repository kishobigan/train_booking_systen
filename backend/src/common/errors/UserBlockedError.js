'use strict';
const AuthorizationError = require('./AuthorizationError');
class UserBlockedError extends AuthorizationError {
  constructor() {
    super('Your account is blocked.');
    this.code = 'USER_BLOCKED';
  }
}
module.exports = UserBlockedError;
