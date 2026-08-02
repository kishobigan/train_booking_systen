'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const { UUID } = require('../stations/station.validator');
function id(value, field = 'routeId') {
  if (!UUID.test(value || '')) throw new ValidationError(`${field} must be a valid UUID`);
  return value;
}
function list(query = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ValidationError('Invalid route pagination');
  for (const field of ['startStationId', 'endStationId']) if (query[field]) id(query[field], field);
  return {
    ...query,
    page,
    limit,
    isActive:
      query.isActive === undefined
        ? undefined
        : query.isActive === 'true' || query.isActive === true,
    q: String(query.q || '').trim() || undefined,
  };
}
function create(input = {}) {
  for (const field of ['code', 'name', 'startStationId', 'endStationId'])
    if (!input[field]) throw new ValidationError(`${field} is required`);
  id(input.startStationId, 'startStationId');
  id(input.endStationId, 'endStationId');
  if (!Array.isArray(input.stations) || input.stations.length < 2)
    throw new ValidationError('At least two stations are required');
  input.stations.forEach((item) => id(item.stationId, 'stationId'));
  return input;
}
function update(input = {}) {
  const allowed = Object.fromEntries(
    ['code', 'name', 'description', 'isActive']
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]])
  );
  if (!Object.keys(allowed).length)
    throw new ValidationError('At least one route field is required');
  return allowed;
}
function routeStation(input = {}) {
  if (input.stationId) id(input.stationId, 'stationId');
  if (input.distanceFromStartKm !== undefined && Number(input.distanceFromStartKm) < 0)
    throw new ValidationError('distanceFromStartKm must be nonnegative');
  return input;
}
function reorder(input = {}) {
  if (!Array.isArray(input.stations) || input.stations.length < 2)
    throw new ValidationError('stations must contain the complete route order');
  input.stations.forEach((item) => {
    id(item.routeStationId, 'routeStationId');
    if (item.sequenceNumber === undefined || item.distanceFromStartKm === undefined)
      throw new ValidationError(
        'Each reorder item requires sequenceNumber and distanceFromStartKm'
      );
  });
  const sorted = [...input.stations].sort(
    (a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)
  );
  if (sorted.some((item, index) => Number(item.sequenceNumber) !== index))
    throw new ValidationError('sequenceNumber must be continuous from zero');
  return sorted;
}
module.exports = { id, list, create, update, routeStation, reorder };
