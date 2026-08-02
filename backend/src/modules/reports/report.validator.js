'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const GROUPS = new Set(['day', 'week', 'month', 'journey', 'route', 'coachClass', 'segment']);
const CLASSES = new Set([
  'FIRST_CLASS',
  'SECOND_CLASS',
  'THIRD_CLASS',
  'OBSERVATION_CLASS',
  'SLEEPER',
]);

function validateReportQuery(input = {}) {
  const today = new Date();
  const dateTo = input.dateTo ? new Date(`${input.dateTo}T00:00:00.000Z`) : today;
  const dateFrom = input.dateFrom
    ? new Date(`${input.dateFrom}T00:00:00.000Z`)
    : new Date(dateTo.getTime() - 30 * 86400000);
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateFrom > dateTo)
    throw new ValidationError('A valid date range is required');
  if ((dateTo - dateFrom) / 86400000 > 366)
    throw new ValidationError('Report range cannot exceed 366 days');
  for (const field of ['journeyId', 'routeId', 'trainId'])
    if (input[field] && !isUuid(input[field])) throw new ValidationError(`${field} must be a UUID`);
  if (input.groupBy && !GROUPS.has(input.groupBy))
    throw new ValidationError('Unsupported report grouping');
  if (input.coachClass && !CLASSES.has(input.coachClass))
    throw new ValidationError('Unsupported coach class');
  return { ...input, dateFrom, dateTo, groupBy: input.groupBy || 'day' };
}
module.exports = { validateReportQuery };
