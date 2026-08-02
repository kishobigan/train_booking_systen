'use strict';

const { DataTypes } = require('sequelize');

const uuid = (extra = {}) => ({ type: DataTypes.UUID, allowNull: false, ...extra });
const id = () => uuid({ primaryKey: true, defaultValue: DataTypes.UUIDV4 });
const foreignKey = (extra = {}) => uuid(extra);
const string = (length, extra = {}) => ({ type: DataTypes.STRING(length), ...extra });
const requiredString = (length, extra = {}) => string(length, { allowNull: false, ...extra });
const decimal = (precision, scale, extra = {}) => ({
  type: DataTypes.DECIMAL(precision, scale),
  ...extra,
});
const requiredDecimal = (precision, scale, extra = {}) =>
  decimal(precision, scale, { allowNull: false, ...extra });
const enumType = (values, extra = {}) => ({
  type: DataTypes.ENUM(...Object.values(values)),
  allowNull: false,
  ...extra,
});
const boolean = (defaultValue, extra = {}) => ({
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue,
  ...extra,
});

const modelOptions = (sequelize, tableName, extra = {}) => ({
  sequelize,
  tableName,
  freezeTableName: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  ...extra,
});

module.exports = {
  DataTypes,
  boolean,
  decimal,
  enumType,
  foreignKey,
  id,
  modelOptions,
  requiredDecimal,
  requiredString,
  string,
};
