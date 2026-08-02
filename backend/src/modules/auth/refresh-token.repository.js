'use strict';
const { Op } = require('sequelize');
const { RefreshToken } = require('../../models');
const BaseRepository = require('../../common/repositories/BaseRepository');
class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super(RefreshToken);
  }
  create(values, options = {}) {
    return RefreshToken.create(values, options);
  }
  findActiveByHash(tokenHash, options = {}) {
    return RefreshToken.scope('withToken').findOne({
      ...options,
      where: { tokenHash, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    });
  }
  findByIdForUpdate(id, transaction) {
    return this.model.scope('withToken').findByPk(id, {
      transaction,
      lock: transaction.LOCK?.UPDATE ?? true,
    });
  }
  revoke(id, options = {}) {
    return RefreshToken.update(
      { revokedAt: new Date() },
      { ...options, where: { id, revokedAt: null } }
    );
  }
  revokeAllForUser(userId, options = {}) {
    return RefreshToken.update(
      { revokedAt: new Date() },
      { ...options, where: { userId, revokedAt: null } }
    );
  }
}
module.exports = RefreshTokenRepository;
