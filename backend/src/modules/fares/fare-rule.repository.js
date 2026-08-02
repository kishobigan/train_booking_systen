'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { FareRule, FareRuleClass } = require('../../models');
class FareRuleRepository extends BaseRepository {
  constructor() {
    super(FareRule);
  }
  findEffective(routeId, travelDate, options = {}) {
    return this.model.findAll({
      ...options,
      where: {
        isActive: true,
        [Op.and]: [
          { routeId },
          { validFrom: { [Op.lte]: travelDate } },
          { [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gte]: travelDate } }] },
        ],
      },
      include: options.include || [{ model: FareRuleClass, as: 'fareRuleClasses' }],
      order: options.order || [
        ['priority', 'DESC'],
        ['validFrom', 'DESC'],
      ],
    });
  }
  findActiveRule(routeId, journeyDate, options = {}) {
    return this.findHighestPriorityRule(routeId, journeyDate, options);
  }
  findApplicableRules(routeId, journeyDate, options = {}) {
    return this.findEffective(routeId, journeyDate, options);
  }
  async findHighestPriorityRule(routeId, journeyDate, options = {}) {
    const [rule] = await this.findEffective(routeId, journeyDate, { ...options, limit: 1 });
    return rule || null;
  }
  findByRoute(routeId, options = {}) {
    return this.findAll({ routeId }, options);
  }
}
module.exports = FareRuleRepository;
