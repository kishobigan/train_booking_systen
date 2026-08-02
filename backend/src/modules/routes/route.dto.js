'use strict';

const ROUTE_FIELDS = Object.freeze([
  'code',
  'name',
  'description',
  'startStationId',
  'endStationId',
  'totalDistanceKm',
  'isActive',
]);

const ROUTE_STATION_FIELDS = Object.freeze([
  'stationId',
  'distanceFromStartKm',
  'defaultArrivalOffsetMinutes',
  'defaultDepartureOffsetMinutes',
  'stopDurationMinutes',
  'canBoard',
  'canAlight',
]);

function pick(input, fields) {
  return Object.fromEntries(
    fields.filter((field) => input?.[field] !== undefined).map((field) => [field, input[field]])
  );
}

function normalizeRouteInput(input = {}) {
  const values = pick(input, ROUTE_FIELDS);
  if (typeof values.code === 'string') values.code = values.code.trim().toUpperCase();
  for (const field of ['name', 'description']) {
    if (typeof values[field] === 'string') values[field] = values[field].trim();
  }
  return values;
}

const normalizeRouteStationInput = (input = {}) => pick(input, ROUTE_STATION_FIELDS);

module.exports = {
  ROUTE_FIELDS,
  ROUTE_STATION_FIELDS,
  normalizeRouteInput,
  normalizeRouteStationInput,
};
