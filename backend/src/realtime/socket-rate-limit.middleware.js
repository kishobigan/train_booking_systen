'use strict';
module.exports = function createSocketRateLimiter(config) {
  return (socket, next) => {
    socket.data.rateLimit = { startedAt: Date.now(), count: 0, max: config.maxEventsPerMinute };
    next();
  };
};
