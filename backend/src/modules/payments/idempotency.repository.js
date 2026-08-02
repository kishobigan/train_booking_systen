'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { IdempotencyRecord } = require('../../models');
class IdempotencyRepository extends BaseRepository {
  constructor() {
    super(IdempotencyRecord);
  }
  find(scope, idempotencyKey, options = {}) {
    return this.findOne({ scope, idempotencyKey }, options);
  }
}
module.exports = IdempotencyRepository;
