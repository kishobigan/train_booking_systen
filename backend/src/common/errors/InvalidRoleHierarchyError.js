'use strict';
const AuthorizationError = require('./AuthorizationError');
class InvalidRoleHierarchyError extends AuthorizationError {
  constructor(message = 'Role hierarchy does not permit this action') {
    super(message);
    this.code = 'INVALID_ROLE_HIERARCHY';
  }
}
module.exports = InvalidRoleHierarchyError;
