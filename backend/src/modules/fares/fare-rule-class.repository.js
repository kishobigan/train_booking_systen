'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { FareRuleClass } = require('../../models');
class FareRuleClassRepository extends BaseRepository {
  constructor() {
    super(FareRuleClass);
  }
  findByFareRuleAndCoachClass(fareRuleId, coachClass, options = {}) {
    return this.findOne({ fareRuleId, coachClass }, options);
  }
  findByFareRuleId(fareRuleId, options = {}) {
    return this.findAll({ fareRuleId }, options);
  }
}
module.exports = FareRuleClassRepository;
