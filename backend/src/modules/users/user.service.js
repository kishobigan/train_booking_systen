'use strict';
const { Op } = require('sequelize');
const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const InvalidRoleHierarchyError = require('../../common/errors/InvalidRoleHierarchyError');
const ValidationError = require('../../common/errors/ValidationError');
const ROLES = require('../../common/constants/roles.constants');
const password = require('../../lib/password');
const { generateTemporaryPassword } = require('../../lib/credential-generator');
const config = require('../../config/auth');
class UserService {
  constructor({
    userRepository,
    accessControlService,
    refreshTokenRepository,
    auditService,
    transactionManager,
  }) {
    Object.assign(this, {
      userRepository,
      accessControlService,
      refreshTokenRepository,
      auditService,
      transactionManager,
    });
  }
  validateCreatorPermission(actor, role) {
    if (!this.accessControlService.canCreateUser(actor, role))
      throw new InvalidRoleHierarchyError('You cannot create a user with this role');
    return true;
  }
  async validateTargetHierarchy(actor, target) {
    if (!(await this.accessControlService.canManageUser(actor, target)))
      throw new InvalidRoleHierarchyError('You cannot manage this user');
    return true;
  }
  generateTemporaryCredential(email) {
    return { username: email, temporaryPassword: generateTemporaryPassword() };
  }
  async createUser({
    actor,
    fullName,
    email,
    phoneNumber,
    role,
    journeyIds = [],
    stationIds = [],
  }) {
    this.validateCreatorPermission(actor, role);
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF].includes(role))
      throw new ValidationError('Unsupported administrative role');
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();
    if (!fullName?.trim() || !normalizedEmail)
      throw new ValidationError('fullName and email are required');
    if (await this.userRepository.findByEmail(normalizedEmail))
      throw new ConflictError('Email already exists');
    if (phoneNumber && (await this.userRepository.findByPhone(phoneNumber)))
      throw new ConflictError('Phone number already exists');
    const credential = this.generateTemporaryCredential(normalizedEmail);
    const passwordHash = await password.hash(credential.temporaryPassword);
    const user = await this.transactionManager.execute(async (transaction) => {
      const created = await this.userRepository.create(
        {
          fullName: fullName.trim(),
          email: normalizedEmail,
          phoneNumber,
          role,
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(
            Date.now() + config.temporaryPasswordTtlHours * 3600000
          ),
        },
        { transaction }
      );
      for (const journeyId of journeyIds)
        await this.accessControlService.assignAdminToJourney({
          actor,
          adminUserId: created.id,
          journeyId,
          transaction,
        });
      for (const stationId of stationIds)
        await this.accessControlService.assignStaffToStation({
          actor,
          staffUserId: created.id,
          stationId,
          transaction,
        });
      await this.auditService.record(
        {
          userId: actor.id,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: created.id,
          newValues: { role },
        },
        { transaction }
      );
      return created;
    });
    return { user: user.toJSON(), temporaryCredential: credential };
  }
  createSuperAdmin(input) {
    return this.createUser({ ...input, role: ROLES.SUPER_ADMIN });
  }
  createAdmin(input) {
    return this.createUser({ ...input, role: ROLES.ADMIN });
  }
  createStaff(input) {
    return this.createUser({ ...input, role: ROLES.STAFF });
  }
  async getUserById(id, actor) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (actor && !this.accessControlService.isSuperAdmin(actor) && actor.id !== id)
      await this.validateTargetHierarchy(actor, user);
    return user;
  }
  getUsers(query = {}) {
    const where = {};
    if (query.role) where.role = query.role;
    if (query.search)
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${query.search}%` } },
        { email: { [Op.iLike]: `%${query.search}%` } },
      ];
    return this.userRepository.paginate(where, query);
  }
  async getManagedStaff(actor, query = {}) {
    if (this.accessControlService.isSuperAdmin(actor))
      return this.getUsers({ ...query, role: ROLES.STAFF });
    if (actor?.role !== ROLES.ADMIN) throw new InvalidRoleHierarchyError();
    const [rows] = await this.userRepository.model.sequelize.query(
      'SELECT DISTINCT ss.staff_user_id AS id FROM staff_stations ss JOIN journey_stations js ON js.station_id = ss.station_id JOIN admin_journeys aj ON aj.journey_id = js.journey_id WHERE ss.is_active = TRUE AND aj.is_active = TRUE AND aj.admin_user_id = :adminUserId',
      { replacements: { adminUserId: actor.id } }
    );
    return this.userRepository.paginate(
      { role: ROLES.STAFF, id: { [Op.in]: rows.map((row) => row.id) } },
      query
    );
  }
  async updateUser({ actor, targetUserId, values }) {
    const target = await this.getUserById(targetUserId);
    await this.validateTargetHierarchy(actor, target);
    const allowed = Object.fromEntries(
      ['fullName', 'email', 'phoneNumber']
        .filter((key) => values[key] !== undefined)
        .map((key) => [key, values[key]])
    );
    return target.update(allowed);
  }
  async blockUser({ actor, targetUserId, reason }) {
    const target = await this.getUserById(targetUserId);
    if (
      !this.accessControlService.canBlockUser(actor, target) ||
      !(await this.accessControlService.canManageUser(actor, target))
    )
      throw new InvalidRoleHierarchyError();
    if (
      target.role === ROLES.SUPER_ADMIN &&
      (await this.userRepository.countActiveSuperAdmins()) <= 1
    )
      throw new InvalidRoleHierarchyError('The last active super admin cannot be blocked');
    return this.transactionManager.execute(async (transaction) => {
      await target.update(
        {
          isActive: false,
          blockedAt: new Date(),
          blockedByUserId: actor.id,
          blockedReason: reason,
        },
        { transaction }
      );
      await this.refreshTokenRepository.revokeAllForUser(target.id, { transaction });
      await this.auditService.record(
        {
          userId: actor.id,
          action: 'USER_BLOCKED',
          entityType: 'User',
          entityId: target.id,
          newValues: { reason },
        },
        { transaction }
      );
      return target;
    });
  }
  async unblockUser({ actor, targetUserId }) {
    const target = await this.getUserById(targetUserId);
    if (
      !this.accessControlService.canUnblockUser(actor, target) ||
      !(await this.accessControlService.canManageUser(actor, target))
    )
      throw new InvalidRoleHierarchyError();
    await target.update({
      isActive: true,
      blockedAt: null,
      blockedByUserId: null,
      blockedReason: null,
    });
    await this.auditService.record({
      userId: actor.id,
      action: 'USER_UNBLOCKED',
      entityType: 'User',
      entityId: target.id,
    });
    return target;
  }
  async resetUserPassword({ actor, targetUserId }) {
    const target = await this.getUserById(targetUserId);
    await this.validateTargetHierarchy(actor, target);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await password.hash(temporaryPassword);
    await this.transactionManager.execute(async (transaction) => {
      await target.update(
        {
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(
            Date.now() + config.temporaryPasswordTtlHours * 3600000
          ),
        },
        { transaction }
      );
      await this.refreshTokenRepository.revokeAllForUser(target.id, { transaction });
      await this.auditService.record(
        {
          userId: actor.id,
          action: 'USER_PASSWORD_RESET',
          entityType: 'User',
          entityId: target.id,
        },
        { transaction }
      );
    });
    return {
      user: target.toJSON(),
      temporaryCredential: { username: target.email, temporaryPassword },
    };
  }
  async changeOwnPassword({ actor, currentPassword, newPassword }) {
    const user = await this.userRepository.findByIdForAuthentication(actor.id);
    if (!(await password.verify(currentPassword, user.passwordHash)))
      throw new ValidationError('Current password is incorrect');
    if (await password.verify(newPassword, user.passwordHash))
      throw new ValidationError('New password must be different');
    await user.update({
      passwordHash: await password.hash(newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    });
    await this.refreshTokenRepository.revokeAllForUser(user.id);
    return user;
  }
  async assignRole({ actor, targetUserId, role }) {
    if (!this.accessControlService.canAssignRole(actor, role))
      throw new InvalidRoleHierarchyError();
    const target = await this.getUserById(targetUserId);
    if (
      target.role === ROLES.SUPER_ADMIN &&
      role !== ROLES.SUPER_ADMIN &&
      (await this.userRepository.countActiveSuperAdmins()) <= 1
    )
      throw new InvalidRoleHierarchyError('The last active super admin cannot be demoted');
    await target.update({ role });
    await this.refreshTokenRepository.revokeAllForUser(target.id);
    await this.auditService.record({
      userId: actor.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: target.id,
      oldValues: { role: target.previous('role') },
      newValues: { role },
    });
    return target;
  }
}
module.exports = UserService;
