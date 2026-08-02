'use strict';
const AuthenticationError = require('../errors/AuthenticationError');
const AUTH = require('../constants/auth.constants');
const jwt = require('../../lib/jwt');
module.exports = (authService) => async (req, res, next) => {
  void res;
  try {
    const authorization = req.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) throw new AuthenticationError();
    const claims = jwt.verify(authorization.slice(7), AUTH.ACCESS_TOKEN);
    const user = await authService.getCurrentUser(claims.sub);
    req.user = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    };
    next();
  } catch (error) {
    next(error);
  }
};
