'use strict';
require('dotenv').config();
const http = require('node:http');
const sequelize = require('../database/sequelize');
const logger = require('../config/logger');
const createJobContainer = require('./job-container');
async function main() {
  const container = createJobContainer();
  await sequelize.authenticate();
  if (!container.config.enabled) {
    logger.warn('Background jobs are disabled');
    await sequelize.close();
    return;
  }
  container.registry.start();
  let server = null;
  if (container.config.healthPort > 0) {
    server = http.createServer(async (req, res) => {
      if (!['/health', '/ready'].includes(req.url)) {
        res.writeHead(404).end();
        return;
      }
      let database = 'connected';
      try {
        await sequelize.authenticate();
      } catch {
        database = 'disconnected';
      }
      const ready = container.registry.initialized && database === 'connected';
      res.writeHead(req.url === '/ready' && !ready ? 503 : 200, {
        'content-type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: req.url === '/ready' ? (ready ? 'ready' : 'not_ready') : 'alive',
          database,
          scheduler: container.registry.initialized ? 'initialized' : 'stopped',
        })
      );
    });
    server.listen(container.config.healthPort, '0.0.0.0', () =>
      logger.info({ port: container.config.healthPort }, 'Worker health server started')
    );
  }
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Background worker shutting down');
    container.registry.stop();
    const timeout = new Promise((resolve) =>
      setTimeout(resolve, container.config.shutdownTimeoutSeconds * 1000)
    );
    await Promise.race([container.runner.waitForActive(), timeout]);
    await container.jobLockService.releaseAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  logger.info({ workerId: container.workerId }, 'Background worker started');
}
if (require.main === module)
  main().catch((error) => {
    logger.fatal({ err: error, code: error.code }, 'Background worker failed to start');
    process.exit(1);
  });
module.exports = { main };
