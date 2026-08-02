'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredDecimal,
  requiredString,
  string,
} = require('../database/common-fields');
const PAYMENT_STATUS = require('../common/constants/payment-status.constants');
class Refund extends Model {
  static initModel(sequelize) {
    Refund.init(
      {
        id: id(),
        paymentId: foreignKey(),
        bookingId: foreignKey(),
        refundReference: requiredString(100, { unique: true }),
        providerRefundReference: string(150),
        amount: requiredDecimal(12, 2, { validate: { min: Number.EPSILON } }),
        reason: { type: DataTypes.TEXT },
        status: enumType(PAYMENT_STATUS, { defaultValue: PAYMENT_STATUS.PROCESSING }),
        processedAt: { type: DataTypes.DATE },
        manualRefundReference: string(150),
        processedByUserId: { type: DataTypes.UUID },
        manualRefundNote: { type: DataTypes.TEXT },
        providerResponse: { type: DataTypes.JSONB },
        failureCode: string(100),
        failureMessage: { type: DataTypes.TEXT },
      },
      modelOptions(sequelize, 'refunds', { timestamps: true })
    );
    return Refund;
  }
  static associate(models) {
    Refund.belongsTo(models.Payment, { as: 'payment', foreignKey: 'paymentId' });
    Refund.belongsTo(models.Booking, { as: 'booking', foreignKey: 'bookingId' });
    Refund.hasMany(models.PaymentReconciliationLog, {
      as: 'reconciliationLogs',
      foreignKey: 'refundId',
    });
  }
}
module.exports = Refund;
