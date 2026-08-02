'use strict';

const sequelize = require('../database/sequelize');
const loadModels = require('../database/model-loader');

module.exports = loadModels(sequelize);
