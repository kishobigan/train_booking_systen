'use strict';
const AuthorizationError = require('../../common/errors/AuthorizationError');
const InvalidRoleHierarchyError = require('../../common/errors/InvalidRoleHierarchyError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ROLES = require('../../common/constants/roles.constants');
class AccessControlService {
  constructor({
    adminJourneyRepository,
    staffStationRepository,
    userRepository,
    journeyRepository,
    stationRepository,
  }) {
    Object.assign(this, {
      adminJourneyRepository,
      staffStationRepository,
      userRepository,
      journeyRepository,
      stationRepository,
    });
  }
  isSuperAdmin(actor) {
    return actor?.role === ROLES.SUPER_ADMIN;
  }
  canCreateUser(actor, role) {
    return this.isSuperAdmin(actor) || (actor?.role === ROLES.ADMIN && role === ROLES.STAFF);
  }
  canAssignRole(actor, role) {
    return this.canCreateUser(actor, role);
  }
  async canManageUser(actor, target) {
    if (this.isSuperAdmin(actor)) return true;
    if (actor?.role !== ROLES.ADMIN || target?.role !== ROLES.STAFF) return false;
    const stations = await this.staffStationRepository.list(target.id);
    for (const assignment of stations)
      if (await this.#adminCanAccessStation(actor.id, assignment.stationId)) return true;
    return false;
  }
  canBlockUser(actor, target) {
    return (
      this.isSuperAdmin(actor) || (actor?.role === ROLES.ADMIN && target?.role === ROLES.STAFF)
    );
  }
  canUnblockUser(actor, target) {
    return this.canBlockUser(actor, target);
  }
  async assignAdminToJourney({ actor, adminUserId, journeyId, transaction }) {
    if (!this.isSuperAdmin(actor)) throw new AuthorizationError();
    const admin = await this.userRepository.findById(adminUserId, { transaction });
    if (!admin || admin.role !== ROLES.ADMIN)
      throw new InvalidRoleHierarchyError('Journey assignments require an ADMIN user');
    if (!(await this.journeyRepository.findById(journeyId, { transaction })))
      throw new NotFoundError('Journey not found');
    await this.adminJourneyRepository.upsert(
      { adminUserId, journeyId, assignedByUserId: actor.id },
      { transaction }
    );
    return this.adminJourneyRepository.findActive(adminUserId, journeyId, { transaction });
  }
  removeAdminFromJourney({ actor, adminUserId, journeyId, transaction }) {
    if (!this.isSuperAdmin(actor)) throw new AuthorizationError();
    return this.adminJourneyRepository.remove(adminUserId, journeyId, { transaction });
  }
  getAdminJourneys(adminUserId, options = {}) {
    return this.adminJourneyRepository.list(adminUserId, options);
  }
  async assertAdminJourneyAccess({ actor, adminUserId = actor?.id, journeyId, transaction }) {
    if (this.isSuperAdmin(actor)) return true;
    if (
      actor?.role !== ROLES.ADMIN ||
      !(await this.adminJourneyRepository.findActive(adminUserId, journeyId, { transaction }))
    )
      throw new AuthorizationError('Journey is outside your assigned scope');
    return true;
  }
  async assignStaffToStation({ actor, staffUserId, stationId, transaction }) {
    const staff = await this.userRepository.findById(staffUserId, { transaction });
    if (!staff || staff.role !== ROLES.STAFF)
      throw new InvalidRoleHierarchyError('Station assignments require a STAFF user');
    if (!(await this.stationRepository.findById(stationId, { transaction })))
      throw new NotFoundError('Station not found');
    if (!this.isSuperAdmin(actor)) {
      if (
        actor?.role !== ROLES.ADMIN ||
        !(await this.#adminCanAccessStation(actor.id, stationId, transaction))
      )
        throw new AuthorizationError('Station is outside your journey scope');
    }
    await this.staffStationRepository.upsert(
      { staffUserId, stationId, assignedByUserId: actor.id },
      { transaction }
    );
    return this.staffStationRepository.findActive(staffUserId, stationId, { transaction });
  }
  async removeStaffFromStation({ actor, staffUserId, stationId, transaction }) {
    if (
      !this.isSuperAdmin(actor) &&
      (actor?.role !== ROLES.ADMIN ||
        !(await this.#adminCanAccessStation(actor.id, stationId, transaction)))
    )
      throw new AuthorizationError();
    return this.staffStationRepository.remove(staffUserId, stationId, { transaction });
  }
  getStaffStations(staffUserId, options = {}) {
    return this.staffStationRepository.list(staffUserId, options);
  }
  async assertStaffStationAccess({ actor, staffUserId = actor?.id, stationId, transaction }) {
    if (this.isSuperAdmin(actor)) return true;
    if (
      actor?.role === ROLES.ADMIN &&
      (await this.#adminCanAccessStation(actor.id, stationId, transaction))
    )
      return true;
    if (
      actor?.role !== ROLES.STAFF ||
      !(await this.staffStationRepository.findActive(staffUserId, stationId, { transaction }))
    )
      throw new AuthorizationError('Station is outside your assigned scope');
    return true;
  }
  async #adminCanAccessStation(adminUserId, stationId, transaction) {
    const sequelize = this.userRepository.model.sequelize;
    const [rows] = await sequelize.query(
      'SELECT 1 FROM admin_journeys aj JOIN journey_stations js ON js.journey_id = aj.journey_id WHERE aj.admin_user_id = :adminUserId AND aj.is_active = TRUE AND js.station_id = :stationId LIMIT 1',
      { replacements: { adminUserId, stationId }, transaction }
    );
    return rows.length > 0;
  }
}
module.exports = AccessControlService;
