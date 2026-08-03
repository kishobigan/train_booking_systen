'use strict';
const { AdminTrainAssignment, Train, User } = require('../../models');
const BaseRepository = require('../../common/repositories/BaseRepository');
const include = [
  { model: User, as: 'admin', attributes: ['id', 'fullName', 'email', 'role'] },
  { model: Train, as: 'train', attributes: ['id', 'trainNumber', 'name', 'isActive'] },
  { model: User, as: 'assignedBy', attributes: ['id', 'fullName'] },
  { model: User, as: 'revokedBy', attributes: ['id', 'fullName'], required: false },
];
class AdminTrainAssignmentRepository extends BaseRepository {
  constructor() { super(AdminTrainAssignment); }
  findActiveAssignment(adminUserId, trainId, options = {}) { return this.findOne({ adminUserId, trainId, isActive: true }, { ...options, include }); }
  findAdminTrainAssignments(adminUserId, options = {}) { return this.model.findAll({ ...options, where: { adminUserId, isActive: true }, include, order: [['assignedAt', 'DESC']] }); }
  findTrainAdminAssignments(trainId, options = {}) { return this.model.findAll({ ...options, where: { trainId, isActive: true }, include, order: [['assignedAt', 'DESC']] }); }
  async findAssignedTrainIds(adminUserId, options = {}) { const rows = await this.model.findAll({ ...options, where: { adminUserId, isActive: true }, attributes: ['trainId'], raw: true }); return rows.map((row) => row.trainId); }
  async isAdminAssignedToTrain(adminUserId, trainId, options = {}) { return Boolean(await this.findActiveAssignment(adminUserId, trainId, options)); }
  assignTrain(values, options = {}) { return this.create({ ...values, isActive: true }, options); }
  async findLatest(adminUserId, trainId, options = {}) { return this.model.findOne({ ...options, where: { adminUserId, trainId }, order: [['createdAt', 'DESC']], include }); }
  async revokeTrain(adminUserId, trainId, values, options = {}) { const record = await this.findActiveAssignment(adminUserId, trainId, options); if (!record) return null; return record.update({ isActive: false, revokedAt: new Date(), ...values }, options); }
  revokeAllAdminTrains(adminUserId, values, options = {}) { return this.model.update({ isActive: false, revokedAt: new Date(), ...values }, { ...options, where: { adminUserId, isActive: true } }); }
  restoreAssignment(record, values, options = {}) { return record.update({ isActive: true, assignedAt: new Date(), revokedAt: null, revokedByUserId: null, revocationReason: null, ...values }, options); }
  getAssignmentHistory(adminUserId, options = {}) { return this.model.findAll({ ...options, where: { adminUserId }, include, order: [['createdAt', 'DESC']] }); }
}
module.exports = AdminTrainAssignmentRepository;
