'use strict';

const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./config/logger');
const apiV1Router = require('./routes');
const notFoundMiddleware = require('./common/middleware/not-found.middleware');
const errorHandlerMiddleware = require('./common/middleware/error-handler.middleware');
const services = require('./container/services');
const { stripeWebhookHandler } = require('./modules/payments/payment.routes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(cors());
  app.post(
    '/api/v1/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    stripeWebhookHandler(services)
  );
  app.use(express.json());

  app.get('/api', (req, res) => {
    res.json({ versions: ['v1'], latest: '/api/v1' });
  });
  app.use('/api/v1', apiV1Router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}

module.exports = createApp;
