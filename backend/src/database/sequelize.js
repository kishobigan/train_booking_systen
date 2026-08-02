'use strict';

require('dotenv').config();

const { Sequelize } = require('sequelize');
const logger = require('../config/logger');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

module.exports = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  timezone: '+00:00',
  logging:
    process.env.NODE_ENV === 'development'
      ? (sql) => logger.debug({ sql }, 'Sequelize query')
      : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: { application_name: 'segment-train-booking-api' },
});
