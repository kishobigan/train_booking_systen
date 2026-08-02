'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { PassengerFareRule } = require('../../models');
class PassengerFareRuleRepository extends BaseRepository {
  constructor() {
    super(PassengerFareRule);
  }
  findByPassengerType(passengerType, options = {}) {
    return this.findOne({ passengerType }, options);
  }
  findActiveByPassengerType(passengerType, options = {}) {
    return this.findOne({ passengerType, isActive: true }, options);
  }
  findActiveRules(options = {}) {
    return this.findAll({ isActive: true }, options);
  }
}
module.exports = PassengerFareRuleRepository;
