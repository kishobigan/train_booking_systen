'use strict';
const AuthenticationError = require('../errors/AuthenticationError');
const AuthorizationError = require('../errors/AuthorizationError');
module.exports =
  (...roles) =>
  (req, res, next) => {
    void res;
    if (!req.user) return next(new AuthenticationError());
    if (!roles.includes(req.user.role)) return next(new AuthorizationError());
    return next();
  };
