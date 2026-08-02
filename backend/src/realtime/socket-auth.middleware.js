'use strict';
const AUTH = require('../common/constants/auth.constants');
const AuthenticationError = require('../common/errors/AuthenticationError');
const jwt = require('../lib/jwt');
module.exports = function createSocketAuth({ userRepository, publicRead = true }) {
  return async (socket, next) => {
    try {
      const header = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token || (header?.startsWith('Bearer ') ? header.slice(7) : null);
      if (!token) {
        if (!publicRead) throw new AuthenticationError();
        socket.user = null;
        return next();
      }
      const claims = jwt.verify(token, AUTH.ACCESS_TOKEN);
      const user = await userRepository.findByIdForAuthentication(claims.sub);
      if (!user || !user.isActive || user.blockedAt || user.deletedAt || user.mustChangePassword)
        throw new AuthenticationError('Socket authentication failed');
      socket.user = { id: user.id, role: user.role };
      return next();
    } catch (error) {
      return next(
        new AuthenticationError('Socket authentication failed', undefined, { cause: error })
      );
    }
  };
};
