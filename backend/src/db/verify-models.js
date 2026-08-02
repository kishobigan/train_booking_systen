'use strict';

require('dotenv').config();

const sequelize = require('../database/sequelize');
const models = require('../models');
const logger = require('../config/logger');

async function verifyModels() {
  const queryInterface = sequelize.getQueryInterface();
  const failures = [];

  await sequelize.authenticate();

  for (const [name, model] of Object.entries(models)) {
    const tableName = model.getTableName();
    const databaseColumns = await queryInterface.describeTable(tableName);
    const attributes = Object.values(model.rawAttributes);
    const modelColumns = attributes.map((attribute) => attribute.field);
    const missingColumns = modelColumns.filter((column) => !databaseColumns[column]);
    const mismatchedColumns = attributes.flatMap((attribute) => {
      const databaseColumn = databaseColumns[attribute.field];
      if (!databaseColumn) return [];

      const mismatches = [];
      if (
        typeof attribute.allowNull === 'boolean' &&
        attribute.allowNull !== databaseColumn.allowNull
      ) {
        mismatches.push(
          `allowNull: model=${attribute.allowNull}, database=${databaseColumn.allowNull}`
        );
      }
      if (Boolean(attribute.primaryKey) !== Boolean(databaseColumn.primaryKey)) {
        mismatches.push(
          `primaryKey: model=${Boolean(attribute.primaryKey)}, database=${Boolean(databaseColumn.primaryKey)}`
        );
      }
      return mismatches.length ? [{ column: attribute.field, mismatches }] : [];
    });

    if (missingColumns.length || mismatchedColumns.length) {
      failures.push({ model: name, table: tableName, missingColumns, mismatchedColumns });
    }
  }

  for (const name of ['User', 'Station', 'Route', 'Train', 'Journey', 'Booking']) {
    await models[name].count();
  }

  if (failures.length) {
    logger.error({ failures }, 'Model verification failed');
    process.exitCode = 1;
  } else {
    logger.info(
      { modelCount: Object.keys(models).length },
      'All Sequelize models match database columns'
    );
  }
}

verifyModels()
  .catch((error) => {
    logger.error({ err: error }, 'Unable to verify Sequelize models');
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
