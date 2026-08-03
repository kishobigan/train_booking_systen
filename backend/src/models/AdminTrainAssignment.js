'use strict';
const { Model } = require('sequelize');
const { DataTypes, boolean, foreignKey, id, modelOptions } = require('../database/common-fields');
class AdminTrainAssignment extends Model {
  static initModel(sequelize) {
    AdminTrainAssignment.init({
      id: id(),
      adminUserId: foreignKey(),
      trainId: foreignKey(),
      assignedByUserId: foreignKey(),
      isActive: boolean(true),
      assignedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      revokedAt: { type: DataTypes.DATE },
      revokedByUserId: { type: DataTypes.UUID },
      revocationReason: { type: DataTypes.TEXT },
    }, modelOptions(sequelize, 'admin_train_assignments', { timestamps: true }));
    return AdminTrainAssignment;
  }
  static associate(models) {
    AdminTrainAssignment.belongsTo(models.User, { as: 'admin', foreignKey: 'adminUserId' });
    AdminTrainAssignment.belongsTo(models.Train, { as: 'train', foreignKey: 'trainId' });
    AdminTrainAssignment.belongsTo(models.User, { as: 'assignedBy', foreignKey: 'assignedByUserId' });
    AdminTrainAssignment.belongsTo(models.User, { as: 'revokedBy', foreignKey: 'revokedByUserId' });
  }
}
module.exports = AdminTrainAssignment;
