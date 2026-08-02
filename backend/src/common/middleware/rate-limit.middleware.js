'use strict';
const AppError = require('../errors/AppError');
function createRateLimiter({ windowMs = 60_000, max = 10 } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const current = clients.get(key);
    const entry =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    clients.set(key, entry);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(max - entry.count, 0)));
    if (entry.count > max)
      return next(
        new AppError(
          'Too many authentication attempts. Try again later.',
          429,
          'RATE_LIMIT_EXCEEDED'
        )
      );
    return next();
  };
}
module.exports = createRateLimiter;
module.exports.authLoginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
module.exports.authRefreshLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 30 });
module.exports.passwordChangeLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
