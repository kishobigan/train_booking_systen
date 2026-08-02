'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { User } = require('../../models');
class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }
  findByEmail(email, options = {}) {
    return this.model.findOne({ ...options, where: { email } });
  }
  findByPhone(phoneNumber, options = {}) {
    return this.model.findOne({ ...options, where: { phoneNumber } });
  }
  findByLogin(login, options = {}) {
    return this.model.findOne({
      ...options,
      where: { [Op.or]: [{ email: login }, { phoneNumber: login }] },
    });
  }
  findForAuthentication(login, options = {}) {
    return this.model
      .scope('withPassword')
      .findOne({ ...options, where: { [Op.or]: [{ email: login }, { phoneNumber: login }] } });
  }
  findActive(where = {}, options = {}) {
    return this.model.scope('active').findAll({ ...options, where });
  }
}
module.exports = UserRepository;
