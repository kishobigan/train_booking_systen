'use strict';

const sequelize = require('../database/sequelize');
const logger = require('../config/logger');
const { printSummary, runSeed } = require('./seeds');

async function main() {
  try {
    const result = await runSeed();
    printSummary(result);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error({ err: error }, 'Seed failed; transaction rolled back');
    process.exitCode = 1;
  });
}

module.exports = { main };
