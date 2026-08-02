'use strict';
const production = process.env.NODE_ENV === 'production';
const allowedOrigins = (
  process.env.WEBSOCKET_ALLOWED_ORIGINS ||
  process.env.CORS_ORIGINS ||
  'http://localhost:3000'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (production && allowedOrigins.includes('*'))
  throw new Error('Wildcard WebSocket origins are forbidden in production');
module.exports = Object.freeze({
  enabled: process.env.WEBSOCKET_ENABLED !== 'false',
  path: process.env.WEBSOCKET_PATH || '/socket.io',
  allowedOrigins,
  pingInterval: Number(process.env.WEBSOCKET_PING_INTERVAL_MS || 25000),
  pingTimeout: Number(process.env.WEBSOCKET_PING_TIMEOUT_MS || 20000),
  maxSubscriptions: Number(process.env.WEBSOCKET_MAX_SUBSCRIPTIONS_PER_SOCKET || 5),
  maxEventsPerMinute: Number(process.env.WEBSOCKET_MAX_EVENTS_PER_MINUTE || 120),
  redisEnabled: process.env.WEBSOCKET_REDIS_ENABLED === 'true',
  redisUrl: process.env.REDIS_URL || '',
});
