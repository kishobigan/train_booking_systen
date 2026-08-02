'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { PaymentWebhookEvent } = require('../../models');
class PaymentWebhookRepository extends BaseRepository {
  constructor() {
    super(PaymentWebhookEvent);
  }
  createEvent(values, options = {}) {
    return this.create(values, options);
  }
  findByProviderEventId(providerName, providerEventId, options = {}) {
    return this.findOne({ providerName, providerEventId }, options);
  }
  findByProviderEventIdForUpdate(providerName, providerEventId, transaction) {
    return this.findOne(
      { providerName, providerEventId },
      { transaction, lock: transaction.LOCK?.UPDATE ?? true }
    );
  }
  async exists(providerName, providerEventId, options = {}) {
    return super.exists({ providerName, providerEventId }, options);
  }
  markProcessed(event, options = {}) {
    return event.update({ processedAt: new Date(), processingError: null }, options);
  }
  markFailed(event, error, options = {}) {
    return event.update({ processingError: String(error).slice(0, 2000) }, options);
  }
}
module.exports = PaymentWebhookRepository;
