'use strict';
const { Model, DataTypes } = require('sequelize');
class JobExecution extends Model {
  static initModel(sequelize) {
    JobExecution.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        jobName: { type: DataTypes.STRING(100), allowNull: false },
        workerId: DataTypes.STRING(150),
        status: { type: DataTypes.STRING(30), allowNull: false },
        startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        finishedAt: DataTypes.DATE,
        recordsFound: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        recordsProcessed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        recordsSucceeded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        recordsFailed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        errorCode: DataTypes.STRING(100),
        errorMessage: DataTypes.TEXT,
        metadata: DataTypes.JSONB,
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      { sequelize, tableName: 'job_executions', timestamps: false, underscored: true }
    );
    return JobExecution;
  }
  static associate() {}
}
module.exports = JobExecution;
