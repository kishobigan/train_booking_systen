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
  findAllPaginated(where, options = {}) {
    return this.model.findAndCountAll({ ...options, where, distinct: true });
  }
  findActive(options = {}) {
    return this.model
      .scope('active')
      .findAll({ ...options, order: options.order || [['name', 'ASC']] });
  }
  search(term, options = {}) {
    const { isActive = true, ...queryOptions } = options;
    return this.model.findAll({
      ...queryOptions,
      where: {
        ...(isActive !== undefined && { isActive }),
        [Op.or]: [
          { code: { [Op.iLike]: `%${term}%` } },
          { name: { [Op.iLike]: `%${term}%` } },
          { localName: { [Op.iLike]: `%${term}%` } },
          { city: { [Op.iLike]: `%${term}%` } },
          { district: { [Op.iLike]: `%${term}%` } },
        ],
      },
      order: options.order || [['name', 'ASC']],
    });
  }
}
module.exports = StationRepository;
