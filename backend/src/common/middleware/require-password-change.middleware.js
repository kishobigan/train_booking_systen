'use strict';
const PasswordChangeRequiredError = require('../errors/PasswordChangeRequiredError');
module.exports = (req, res, next) => {
  void res;
  return req.user?.mustChangePassword ? next(new PasswordChangeRequiredError()) : next();
};
