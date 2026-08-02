'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function boolean(value, field) {
  if (value === undefined) return undefined;
  if (!['true', 'false', true, false].includes(value))
    throw new ValidationError(`${field} must be boolean`);
  return value === true || value === 'true';
}
function validateListQuery(query = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1) throw new ValidationError('page must be positive');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ValidationError('limit must be between 1 and 100');
  if (query.sortBy && !['name', 'code', 'city', 'district', 'createdAt'].includes(query.sortBy))
    throw new ValidationError('Unsupported station sort field');
  if (query.sortOrder && !['asc', 'desc', 'ASC', 'DESC'].includes(query.sortOrder))
    throw new ValidationError('sortOrder must be asc or desc');
  return { ...query, page, limit, isActive: boolean(query.isActive, 'isActive') };
}
function validateSearchQuery(query = {}) {
  const q = String(query.q || '').trim();
  if (q.length < 2) throw new ValidationError('q must contain at least two characters');
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ValidationError('limit must be between 1 and 100');
  return { q, limit, isActive: boolean(query.isActive, 'isActive') ?? true };
}
function validateStationId(id) {
  if (!UUID.test(id || '')) throw new ValidationError('stationId must be a valid UUID');
  return id;
}
module.exports = { UUID, validateListQuery, validateSearchQuery, validateStationId };
