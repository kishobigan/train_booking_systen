'use strict';
const AuthenticationError = require('./AuthenticationError');
class InvalidTokenError extends AuthenticationError {
  constructor(message = 'The token is invalid.') {
    super(message);
    this.code = 'INVALID_TOKEN';
  }
}
module.exports = InvalidTokenError;
