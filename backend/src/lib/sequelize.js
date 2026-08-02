'use strict';

const { Sequelize } = require('sequelize');
const logger = require('../config/logger');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging:
    process.env.NODE_ENV === 'development'
      ? (sql) => logger.debug({ sql }, 'Sequelize query')
      : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = sequelize;
