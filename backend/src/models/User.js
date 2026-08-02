'use strict';
const { Model } = require('sequelize');
const {
  DataTypes,
  boolean,
  enumType,
  id,
  modelOptions,
  requiredString,
  string,
} = require('../database/common-fields');
const USER_ROLE = require('../common/constants/user-role.constants');
class User extends Model {
  static initModel(sequelize) {
    User.init(
      {
        id: id(),
        fullName: requiredString(150),
        email: { type: DataTypes.CITEXT, unique: true, validate: { isEmail: true } },
        phoneNumber: string(30, { unique: true }),
        passwordHash: { type: DataTypes.TEXT },
        role: enumType(USER_ROLE, { defaultValue: USER_ROLE.PASSENGER }),
        emailVerifiedAt: { type: DataTypes.DATE },
        phoneVerifiedAt: { type: DataTypes.DATE },
        isActive: boolean(true),
        mustChangePassword: boolean(true),
        passwordChangedAt: { type: DataTypes.DATE },
        temporaryPasswordExpiresAt: { type: DataTypes.DATE },
        blockedAt: { type: DataTypes.DATE },
        blockedByUserId: { type: DataTypes.UUID },
        blockedReason: { type: DataTypes.TEXT },
      },
      modelOptions(sequelize, 'users', {
        timestamps: true,
        paranoid: true,
        defaultScope: { attributes: { exclude: ['passwordHash'] } },
        scopes: {
          withPassword: { attributes: { include: ['passwordHash'] } },
          active: { where: { isActive: true } },
        },
      })
    );
    return User;
  }
  static associate(models) {
    User.hasMany(models.RefreshToken, { as: 'refreshTokens', foreignKey: 'userId' });
    User.hasMany(models.Booking, { as: 'bookings', foreignKey: 'userId' });
    User.hasMany(models.WaitlistEntry, { as: 'waitlistEntries', foreignKey: 'userId' });
    User.hasMany(models.Notification, { as: 'notifications', foreignKey: 'userId' });
    User.hasMany(models.AuditLog, { as: 'auditLogs', foreignKey: 'userId' });
    User.hasMany(models.BookingStatusHistory, {
      as: 'changedBookingStatuses',
      foreignKey: 'changedByUserId',
    });
    User.belongsToMany(models.Journey, {
      as: 'adminJourneys',
      through: models.AdminJourney,
      foreignKey: 'adminUserId',
      otherKey: 'journeyId',
    });
    User.belongsToMany(models.Station, {
      as: 'staffStations',
      through: models.StaffStation,
      foreignKey: 'staffUserId',
      otherKey: 'stationId',
    });
  }
  toJSON() {
    const values = { ...this.get() };
    delete values.passwordHash;
    delete values.password_hash;
    return values;
  }
  isAdmin() {
    return [USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN].includes(this.role);
  }
}
module.exports = User;
