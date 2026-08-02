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
          { [Op.or]: [{ routeId }, { routeId: null }] },
          { validFrom: { [Op.lte]: travelDate } },
          { [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gte]: travelDate } }] },
        ],
      },
      include: options.include || [{ model: FareRuleClass, as: 'fareRuleClasses' }],
      order: options.order || [['priority', 'DESC']],
    });
  }
  findByRoute(routeId, options = {}) {
    return this.findAll({ routeId }, options);
  }
}
module.exports = FareRuleRepository;
