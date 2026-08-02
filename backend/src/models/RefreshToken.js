'use strict';
const { Model } = require('sequelize');
const { DataTypes, foreignKey, id, modelOptions } = require('../database/common-fields');
class RefreshToken extends Model {
  static initModel(sequelize) {
    RefreshToken.init(
      {
        id: id(),
        userId: foreignKey(),
        tokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        revokedAt: { type: DataTypes.DATE },
      },
      modelOptions(sequelize, 'refresh_tokens', {
        timestamps: true,
        updatedAt: false,
        defaultScope: { attributes: { exclude: ['tokenHash'] } },
        scopes: { withToken: { attributes: { include: ['tokenHash'] } } },
      })
    );
    return RefreshToken;
  }
  static associate(models) {
    RefreshToken.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
  }
}
module.exports = RefreshToken;
