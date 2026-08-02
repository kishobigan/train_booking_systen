'use strict';
const { Model } = require('sequelize');
const { DataTypes, id, modelOptions, requiredString } = require('../database/common-fields');
class PaymentWebhookEvent extends Model {
  static initModel(sequelize) {
    PaymentWebhookEvent.init(
      {
        id: id(),
        providerName: requiredString(100),
        providerEventId: requiredString(200),
        eventType: requiredString(100),
        payload: { type: DataTypes.JSONB, allowNull: false },
        processedAt: { type: DataTypes.DATE },
        processingError: { type: DataTypes.TEXT },
      },
      modelOptions(sequelize, 'payment_webhook_events', {
        timestamps: true,
        updatedAt: false,
        defaultScope: { attributes: { exclude: ['payload'] } },
        scopes: { withPayload: { attributes: { include: ['payload'] } } },
      })
    );
    return PaymentWebhookEvent;
  }
  static associate() {}
}
module.exports = PaymentWebhookEvent;
