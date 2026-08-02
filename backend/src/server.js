'use strict';
const http = require('node:http');
const createApp = require('./app');
const logger = require('./config/logger');
const sequelize = require('./database/sequelize');
const services = require('./container/services');
const websocketConfig = require('./config/websocket');
const createSocketServer = require('./realtime/socket-server');
const SocketContext = require('./realtime/socket-context');
const SeatMapSocket = require('./modules/seatmap/seatmap.socket');
const SeatMapPublisher = require('./modules/seatmap/seatmap.publisher');
const repositories = require('./container/repositories');

async function startServer() {
  const port = Number(process.env.PORT) || 4050;
  const server = http.createServer(createApp());
  let socketServer = null;
  if (websocketConfig.enabled) {
    const roomRegistry = new SocketContext();
    const seatMapSocket = new SeatMapSocket({
      seatMapService: services.seatMapService,
      roomRegistry,
      config: websocketConfig,
      logger,
    });
    socketServer = await createSocketServer({
      httpServer: server,
      seatMapSocket,
      userRepository: repositories.userRepository,
      config: websocketConfig,
      logger,
    });
    services.seatMapService.redis = socketServer.redis;
    const publisher = new SeatMapPublisher({
      io: socketServer.io,
      roomRegistry,
      seatMapService: services.seatMapService,
      logger,
    });
    services.seatMapPublisher = publisher;
    for (const service of [
      services.bookingService,
      services.bookingStatusService,
      services.waitlistService,
      services.waitlistOfferService,
      services.journeyService,
      services.journeySeatService,
      services.journeyCoachService,
    ])
      service.seatMapPublisher = publisher;
  }
  server.listen(port, () => {
    logger.info({ port }, 'API server started');
    services.emailProvider
      ?.verify()
      .then((verified) => verified && logger.info('SMTP connection verified'))
      .catch((error) => logger.warn({ code: error.code }, 'SMTP verification failed'));
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutting down API server');
    await socketServer?.close();
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'HTTP server shutdown failed');
        process.exitCode = 1;
      }

      try {
        await sequelize.close();
      } catch (databaseError) {
        logger.error({ err: databaseError }, 'Database shutdown failed');
        process.exitCode = 1;
      }
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

module.exports = startServer;
