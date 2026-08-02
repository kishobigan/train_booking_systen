'use strict';
const ValidationError = require('../../common/errors/ValidationError');
function validateAssignment(value, field) {
  if (!value?.[field]) throw new ValidationError(`${field} is required`);
  return value;
}
module.exports = {
  validateJourneyAssignment: (v) => validateAssignment(v, 'journeyId'),
  validateStationAssignment: (v) => validateAssignment(v, 'stationId'),
};
