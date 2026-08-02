'use strict';
const { createHash } = require('node:crypto');
const ConflictError = require('../../common/errors/ConflictError');
const config = require('../../config/payment');
class IdempotencyService {
  constructor(repository) {
    this.repository = repository;
  }
  hash(request) {
    return createHash('sha256')
      .update(JSON.stringify(request, Object.keys(request).sort()))
      .digest('hex');
  }
  async begin({ scope, key, request, transaction }) {
    if (!key) return null;
    const requestHash = this.hash(request);
    const existing = await this.repository.find(scope, key, { transaction });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictError('Idempotency key was already used for a different request');
      return existing;
    }
    return this.repository.create(
      {
        scope,
        idempotencyKey: key,
        requestHash,
        expiresAt: new Date(Date.now() + config.idempotencyTtlHours * 3600000),
      },
      { transaction }
    );
  }
  async complete(
    record,
    { resourceType, resourceId, responseStatus = 200, responseBody },
    transaction
  ) {
    if (!record) return;
    await record.update(
      { resourceType, resourceId, responseStatus, responseBody },
      { transaction }
    );
  }
}
module.exports = IdempotencyService;
