'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const { User, Journey, Station, Train } = require('../../models');
const assignmentIncludes = [
  { model: Journey, as: 'adminJourneys', attributes: ['id'], through: { attributes: [] }, required: false },
  { model: Station, as: 'staffStations', attributes: ['id'], through: { attributes: [], where: { isActive: true } }, required: false },
  { model: Train, as: 'adminTrains', attributes: ['id'], through: { attributes: [], where: { isActive: true } }, required: false },
];
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
      .unscoped()
      .scope('withPassword')
      .findOne({ ...options, include: assignmentIncludes, where: { [Op.or]: [{ email: login }, { phoneNumber: login }] } });
  }
  findByIdForAuthentication(id, options = {}) {
    const include = options.include ?? (options.lock ? [] : assignmentIncludes);
    return this.model.unscoped().scope('withPassword').findByPk(id, { ...options, include });
  }
  countActiveSuperAdmins(options = {}) {
    return this.model.count({
      ...options,
      where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null },
    });
  }
  findActive(where = {}, options = {}) {
    return this.model.scope('active').findAll({ ...options, where });
  }
}
module.exports = UserRepository;
