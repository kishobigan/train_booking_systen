'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Station } = require('../../models');
class StationRepository extends BaseRepository {
  constructor() {
    super(Station);
  }
  findByCode(code, options = {}) {
    return this.findOne({ code }, options);
  }
  findActive(options = {}) {
    return this.model
      .scope('active')
      .findAll({ ...options, order: options.order || [['name', 'ASC']] });
  }
  search(term, options = {}) {
    return this.model.scope('active').findAll({
      ...options,
      where: {
        [Op.or]: [
          { code: { [Op.iLike]: `%${term}%` } },
          { name: { [Op.iLike]: `%${term}%` } },
          { city: { [Op.iLike]: `%${term}%` } },
        ],
      },
      order: options.order || [['name', 'ASC']],
    });
  }
}
module.exports = StationRepository;
