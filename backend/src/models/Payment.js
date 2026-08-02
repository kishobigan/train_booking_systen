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
const PAYMENT_METHOD = require('../common/constants/payment-method.constants');
const PAYMENT_STATUS = require('../common/constants/payment-status.constants');
class Payment extends Model {
  static initModel(sequelize) {
    Payment.init(
      {
        id: id(),
        bookingId: foreignKey(),
        paymentReference: requiredString(100, { unique: true }),
        providerReference: string(150),
        method: enumType(PAYMENT_METHOD),
        status: enumType(PAYMENT_STATUS, { defaultValue: PAYMENT_STATUS.PENDING }),
        amount: requiredDecimal(12, 2, { validate: { min: Number.EPSILON } }),
        currency: requiredString(3, { defaultValue: 'LKR' }),
        providerName: string(100),
        paidAt: { type: DataTypes.DATE },
        failedAt: { type: DataTypes.DATE },
        failureCode: string(100),
        failureMessage: { type: DataTypes.TEXT },
        providerResponse: { type: DataTypes.JSONB },
      },
      modelOptions(sequelize, 'payments', { timestamps: true })
    );
    return Payment;
  }
  static associate(models) {
    Payment.belongsTo(models.Booking, { as: 'booking', foreignKey: 'bookingId' });
    Payment.hasMany(models.Refund, { as: 'refunds', foreignKey: 'paymentId' });
    Payment.hasMany(models.BankPaymentSlip, { as: 'bankSlips', foreignKey: 'paymentId' });
    Payment.hasMany(models.PaymentReconciliationLog, {
      as: 'reconciliationLogs',
      foreignKey: 'paymentId',
    });
  }
  isSuccessful() {
    return this.status === PAYMENT_STATUS.PAID;
  }
}
module.exports = Payment;
