'use strict';

const express = require('express');
const sequelize = require('../database/sequelize');
const services = require('../container/services');
const createFareRouter = require('../modules/fares/fare.routes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ name: 'Train Booking API', version: 'v1' });
});

router.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', database: 'connected', version: 'v1' });
  } catch (error) {
    req.log.warn({ err: error }, 'Database health check failed');
    res.status(503).json({ status: 'error', database: 'disconnected', version: 'v1' });
  }
});

router.use('/fares', createFareRouter(services.fareCalculationService));

module.exports = router;
