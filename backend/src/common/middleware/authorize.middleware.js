'use strict';
const AuthenticationError = require('../errors/AuthenticationError');
const AuthorizationError = require('../errors/AuthorizationError');
const ROLES = require('../constants/user-role.constants');
module.exports = (...roles) => {
  if (!roles.length || roles.some((role) => !Object.values(ROLES).includes(role)))
    throw new TypeError('authorize requires valid role constants');
  return (req, res, next) => {
    void res;
    if (!req.user) return next(new AuthenticationError());
    if (!roles.includes(req.user.role)) return next(new AuthorizationError());
    return next();
  };
};
