'use strict';
const FareRuleClassRepository = require('./fare-rule-class.repository');
class FareRuleClassService {
  constructor(repository = new FareRuleClassRepository()) {
    this.repository = repository;
  }
  /** Resolve optional coach-class overrides for a fare rule. */
  findForClass(fareRuleId, coachClass, options = {}) {
    return this.repository.findByFareRuleAndCoachClass(fareRuleId, coachClass, options);
  }
  /** List coach-class overrides for a fare rule. */
  listForRule(fareRuleId, options = {}) {
    return this.repository.findByFareRuleId(fareRuleId, options);
  }
}
module.exports = FareRuleClassService;
