'use strict';
const FareRuleNotFoundError = require('../../common/errors/FareRuleNotFoundError');
const FareRuleRepository = require('./fare-rule.repository');
class FareRuleService {
  constructor(repository = new FareRuleRepository()) {
    this.repository = repository;
  }
  /** Resolve the highest-priority active fare rule for a route and journey date. */
  async resolve(routeId, journeyDate, options = {}) {
    const rule = await this.repository.findHighestPriorityRule(routeId, journeyDate, options);
    if (!rule) throw new FareRuleNotFoundError(undefined, { routeId, journeyDate });
    return rule;
  }
  /** List all applicable rules in business-priority order. */
  listApplicable(routeId, journeyDate, options = {}) {
    return this.repository.findApplicableRules(routeId, journeyDate, options);
  }
}
module.exports = FareRuleService;
