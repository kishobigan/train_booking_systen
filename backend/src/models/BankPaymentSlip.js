'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  foreignKey,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
class BankPaymentSlip extends Model {
  static initModel(sequelize) {
    BankPaymentSlip.init(
      {
        id: id(),
        paymentId: foreignKey(),
        uploadedByUserId: { type: DataTypes.UUID },
        originalFileName: string(255),
        storedFileName: string(255),
        storageProvider: requiredString(50),
        storageKey: { type: DataTypes.TEXT, allowNull: false },
        mimeType: requiredString(100),
        fileSizeBytes: { type: DataTypes.BIGINT, allowNull: false },
        fileHash: requiredString(128),
        bankTransactionReference: string(150),
        transferDate: { type: DataTypes.DATEONLY },
        depositorName: string(150),
        submittedAmount: { type: DataTypes.DECIMAL(12, 2) },
        status: requiredString(30, { defaultValue: 'UPLOADED' }),
        uploadedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        verifiedByUserId: { type: DataTypes.UUID },
        verifiedAt: { type: DataTypes.DATE },
        rejectedByUserId: { type: DataTypes.UUID },
        rejectedAt: { type: DataTypes.DATE },
        verificationNote: { type: DataTypes.TEXT },
        rejectionReason: { type: DataTypes.TEXT },
      },
      modelOptions(sequelize, 'bank_payment_slips', { timestamps: true })
    );
    return BankPaymentSlip;
  }
  static associate(models) {
    BankPaymentSlip.belongsTo(models.Payment, { as: 'payment', foreignKey: 'paymentId' });
    BankPaymentSlip.belongsTo(models.User, { as: 'uploadedBy', foreignKey: 'uploadedByUserId' });
  }
}
module.exports = BankPaymentSlip;
