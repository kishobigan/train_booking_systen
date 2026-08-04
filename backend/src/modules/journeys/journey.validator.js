'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const COACH_CLASS = require('../../common/constants/coach-class.constants');
const fareConfig = require('../../config/fare');
const { UUID } = require('../stations/station.validator');
function id(value) {
  if (!UUID.test(value || '')) throw new ValidationError('journeyId must be a valid UUID');
  return value;
}
function search(query = {}) {
  for (const field of ['originStationId', 'destinationStationId'])
    if (!UUID.test(query[field] || '')) throw new ValidationError(`${field} must be a valid UUID`);
  if (query.originStationId === query.destinationStationId)
    throw new ValidationError('Origin and destination must differ');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(query.date || '') ||
    Number.isNaN(new Date(`${query.date}T00:00:00Z`).getTime())
  )
    throw new ValidationError('date must use YYYY-MM-DD');
  const passengerCount = Number(query.passengerCount || 1);
  if (
    !Number.isInteger(passengerCount) ||
    passengerCount < 1 ||
    passengerCount > fareConfig.maximumPassengersPerBooking
  )
    throw new ValidationError('Invalid passengerCount');
  if (query.coachClass && !Object.values(COACH_CLASS).includes(query.coachClass))
    throw new ValidationError('Unsupported coachClass');
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ValidationError('Invalid pagination');
  return {
    originStationId: query.originStationId,
    destinationStationId: query.destinationStationId,
    date: query.date,
    coachClass: query.coachClass,
    passengerCount,
    page,
    limit,
  };
}
function upcoming(query = {}) {
  const originStationId = query.originStationId || null;
  const destinationStationId = query.destinationStationId || null;
  if (originStationId && !UUID.test(originStationId))
    throw new ValidationError('originStationId must be a valid UUID');
  if (destinationStationId && !UUID.test(destinationStationId))
    throw new ValidationError('destinationStationId must be a valid UUID');
  if (originStationId && destinationStationId && originStationId === destinationStationId)
    throw new ValidationError('Origin and destination must differ');
  for (const field of ['dateFrom', 'dateTo']) {
    if (query[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(query[field]) || Number.isNaN(new Date(`${query[field]}T00:00:00Z`).getTime())))
      throw new ValidationError(`${field} must use YYYY-MM-DD`);
  }
  const passengerCount = Number(query.passengerCount || 1);
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > fareConfig.maximumPassengersPerBooking)
    throw new ValidationError('Invalid passengerCount');
  if (query.coachClass && !Object.values(COACH_CLASS).includes(query.coachClass))
    throw new ValidationError('Unsupported coachClass');
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ValidationError('Invalid pagination');
  const sortBy = ['departure', 'duration', 'availability'].includes(query.sortBy)
    ? query.sortBy
    : 'departure';
  const sortOrder = String(query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return {
    originStationId,
    destinationStationId,
    dateFrom: query.dateFrom || null,
    dateTo: query.dateTo || null,
    coachClass: query.coachClass || null,
    passengerCount,
    page,
    limit,
    sortBy,
    sortOrder,
  };
}
module.exports = { id, search, upcoming };
