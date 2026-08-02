'use strict';

const createApp = require('./app');
const logger = require('./config/logger');
const sequelize = require('./lib/sequelize');

function startServer() {
  const port = Number(process.env.PORT) || 4050;
  const server = createApp().listen(port, () => {
    logger.info({ port }, 'API server started');
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutting down API server');
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
