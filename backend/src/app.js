'use strict';

const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./config/logger');
const apiV1Router = require('./routes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(cors());
  app.use(express.json());

  app.get('/api', (req, res) => {
    res.json({ versions: ['v1'], latest: '/api/v1' });
  });
  app.use('/api/v1', apiV1Router);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
    req.log.error({ err }, 'Unhandled request error');
    if (res.headersSent) return next(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
