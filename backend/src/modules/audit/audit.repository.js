'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { AuditLog, User } = require('../../models');
class AuditRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }
  findByEntity(entityType, entityId, options = {}) {
    return this.findAll(
      { entityType, entityId },
      {
        ...options,
        include: options.include || [{ model: User, as: 'user' }],
        order: options.order || [['created_at', 'DESC']],
      }
    );
  }
  findByUser(userId, options = {}) {
    return this.findAll(
      { userId },
      { ...options, order: options.order || [['created_at', 'DESC']] }
    );
  }
  findByRequest(requestId, options = {}) {
    return this.findAll({ requestId }, options);
  }
}
module.exports = AuditRepository;
