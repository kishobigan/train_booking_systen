'use strict';
const AuthenticationError = require('./AuthenticationError');
class TokenExpiredError extends AuthenticationError {
  constructor(type = 'access') {
    super(type === 'access' ? 'Your access token has expired.' : 'The token has expired.');
    this.code = type === 'access' ? 'ACCESS_TOKEN_EXPIRED' : 'TOKEN_EXPIRED';
  }
}
module.exports = TokenExpiredError;
