'use strict';
const AuthenticationError = require('./AuthenticationError');
class UserBlockedError extends AuthenticationError {
  constructor() {
    super('This account is blocked');
    this.code = 'USER_BLOCKED';
  }
}
module.exports = UserBlockedError;
