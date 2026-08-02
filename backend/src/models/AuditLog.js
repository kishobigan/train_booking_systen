'use strict';
const { Model } = require('sequelize');
const { DataTypes, id, modelOptions, requiredString } = require('../database/common-fields');
class AuditLog extends Model {
  static initModel(sequelize) {
    AuditLog.init(
      {
        id: id(),
        userId: { type: DataTypes.UUID },
        action: requiredString(100),
        entityType: requiredString(100),
        entityId: { type: DataTypes.UUID },
        oldValues: { type: DataTypes.JSONB },
        newValues: { type: DataTypes.JSONB },
        ipAddress: { type: DataTypes.INET },
        userAgent: { type: DataTypes.TEXT },
        requestId: { type: DataTypes.UUID },
      },
      modelOptions(sequelize, 'audit_logs', { timestamps: true, updatedAt: false })
    );
    return AuditLog;
  }
  static associate(models) {
    AuditLog.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
  }
}
module.exports = AuditLog;
