'use strict';
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const createSocketAuth = require('./socket-auth.middleware');
const createRateLimiter = require('./socket-rate-limit.middleware');
const { createRedisClients } = require('../lib/redis');
async function createSocketServer({ httpServer, seatMapSocket, userRepository, config, logger }) {
  const io = new Server(httpServer, {
    path: config.path,
    cors: { origin: config.allowedOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: config.pingInterval,
    pingTimeout: config.pingTimeout,
    maxHttpBufferSize: 16384,
  });
  io.use(createSocketAuth({ userRepository, publicRead: true }));
  io.use(createRateLimiter(config));
  let redisClients = null;
  if (config.redisEnabled) {
    try {
      redisClients = await createRedisClients(config.redisUrl);
      io.adapter(createAdapter(redisClients.publisher, redisClients.subscriber));
      logger.info('Socket.IO Redis adapter connected');
    } catch (error) {
      logger.error({ err: error }, 'Socket.IO Redis adapter failed');
      throw error;
    }
  }
  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket connected');
    seatMapSocket.register(socket);
    socket.on('disconnect', (reason) =>
      logger.debug({ socketId: socket.id, reason }, 'Socket disconnected')
    );
  });
  return {
    io,
    redis: redisClients?.publisher || null,
    close: async () => {
      await new Promise((resolve) => io.close(resolve));
      await redisClients?.close();
    },
  };
}
module.exports = createSocketServer;
