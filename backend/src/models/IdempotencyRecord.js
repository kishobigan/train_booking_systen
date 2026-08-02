'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
class IdempotencyRecord extends Model {
  static initModel(sequelize) {
    IdempotencyRecord.init(
      {
        id: id(),
        scope: requiredString(100),
        idempotencyKey: requiredString(200),
        requestHash: requiredString(64),
        resourceType: string(100),
        resourceId: { type: DataTypes.UUID },
        responseStatus: { type: DataTypes.INTEGER },
        responseBody: { type: DataTypes.JSONB },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
      },
      modelOptions(sequelize, 'idempotency_records', { timestamps: true, updatedAt: false })
    );
    return IdempotencyRecord;
  }
  static associate() {}
}
module.exports = IdempotencyRecord;
