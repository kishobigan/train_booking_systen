'use strict';

class BaseRepository {
  constructor(model) {
    if (!model) throw new TypeError('A Sequelize model is required');
    this.model = model;
  }

  create(values, options = {}) {
    return this.model.create(values, options);
  }
  bulkCreate(values, options = {}) {
    return this.model.bulkCreate(values, options);
  }
  findById(id, options = {}) {
    return this.model.findByPk(id, options);
  }
  findOne(where, options = {}) {
    return this.model.findOne({ ...options, where });
  }
  findAll(where = {}, options = {}) {
    return this.model.findAll({ ...options, where });
  }
  count(where = {}, options = {}) {
    return this.model.count({ ...options, where });
  }

  async exists(where, options = {}) {
    return (await this.model.count({ ...options, where, limit: 1 })) > 0;
  }

  async paginate(where = {}, options = {}) {
    const page = Math.max(Number(options.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(options.pageSize) || 20, 1), 100);
    const { page: ignoredPage, pageSize: ignoredPageSize, ...queryOptions } = options;
    void ignoredPage;
    void ignoredPageSize;
    const { count, rows } = await this.model.findAndCountAll({
      ...queryOptions,
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      distinct: queryOptions.include ? true : queryOptions.distinct,
    });
    return { rows, page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) };
  }

  async updateById(id, values, options = {}) {
    const record = await this.findById(id, options);
    if (!record) return null;
    return record.update(values, options);
  }

  async deleteById(id, options = {}) {
    const record = await this.findById(id, options);
    if (!record) return false;
    await record.destroy(options);
    return true;
  }

  async restoreById(id, options = {}) {
    const record = await this.findById(id, { ...options, paranoid: false });
    if (!record || typeof record.restore !== 'function') return null;
    return record.restore(options);
  }
}

module.exports = BaseRepository;
