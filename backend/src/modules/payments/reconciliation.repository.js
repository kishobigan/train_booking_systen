'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { PaymentReconciliationLog } = require('../../models');
class ReconciliationRepository extends BaseRepository {
  constructor() {
    super(PaymentReconciliationLog);
  }
}
module.exports = ReconciliationRepository;
