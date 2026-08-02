'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
class PaymentReconciliationLog extends Model {
  static initModel(sequelize) {
    PaymentReconciliationLog.init(
      {
        id: id(),
        paymentId: { type: DataTypes.UUID },
        refundId: { type: DataTypes.UUID },
        providerName: string(100),
        internalStatusBefore: string(50),
        providerStatus: string(50),
        internalStatusAfter: string(50),
        result: requiredString(50),
        differenceType: string(100),
        details: { type: DataTypes.JSONB },
        reconciledBy: requiredString(100, { defaultValue: 'SYSTEM' }),
      },
      modelOptions(sequelize, 'payment_reconciliation_logs', { timestamps: true, updatedAt: false })
    );
    return PaymentReconciliationLog;
  }
  static associate(models) {
    PaymentReconciliationLog.belongsTo(models.Payment, { as: 'payment', foreignKey: 'paymentId' });
    PaymentReconciliationLog.belongsTo(models.Refund, { as: 'refund', foreignKey: 'refundId' });
  }
}
module.exports = PaymentReconciliationLog;
