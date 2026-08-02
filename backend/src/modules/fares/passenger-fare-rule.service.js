'use strict';
const PassengerFareRuleRepository = require('./passenger-fare-rule.repository');
class PassengerFareRuleService {
  constructor(repository = new PassengerFareRuleRepository()) {
    this.repository = repository;
  }
  /** Resolve an active passenger discount, returning null for the optional fallback. */
  findActive(passengerType, options = {}) {
    return this.repository.findActiveByPassengerType(passengerType, options);
  }
  /** List every active passenger discount rule. */
  listActive(options = {}) {
    return this.repository.findActiveRules(options);
  }
}
module.exports = PassengerFareRuleService;
