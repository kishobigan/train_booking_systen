'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const PASSENGER_TYPE = require('../../common/constants/passenger-type.constants');
const { UUID } = require('../fares/fare.validator');
function validateHold(input, maximumPassengers = 6) {
  for (const field of ['journeyId', 'originJourneyStationId', 'destinationJourneyStationId'])
    if (!UUID.test(input[field] || '')) throw new ValidationError(`${field} must be a valid UUID`);
  if (
    !Array.isArray(input.passengers) ||
    !input.passengers.length ||
    input.passengers.length > maximumPassengers
  )
    throw new ValidationError(`passengers must contain between 1 and ${maximumPassengers} entries`);
  const seats = new Set();
  for (const passenger of input.passengers) {
    if (!String(passenger.fullName || '').trim() || passenger.fullName.length > 150)
      throw new ValidationError('Passenger fullName is required and limited to 150 characters');
    if (!Object.values(PASSENGER_TYPE).includes(passenger.passengerType))
      throw new ValidationError('Unsupported passengerType');
    if (!UUID.test(passenger.journeySeatId || ''))
      throw new ValidationError('Every journeySeatId must be a valid UUID');
    if (seats.has(passenger.journeySeatId))
      throw new ValidationError('Duplicate journeySeatId values are not allowed');
    seats.add(passenger.journeySeatId);
  }
  if (!input.contact?.fullName || input.contact.fullName.length > 150)
    throw new ValidationError('Contact fullName is required and limited to 150 characters');
  if (!input.contact.email && !input.contact.phone)
    throw new ValidationError('Contact email or phone is required');
  if (input.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact.email))
    throw new ValidationError('Contact email is invalid');
  return input;
}
function validateConfirmation(input) {
  if (!UUID.test(input.bookingId || '') || !UUID.test(input.paymentId || ''))
    throw new ValidationError('bookingId and paymentId must be valid UUIDs');
  return input;
}
function validateCancellation(input) {
  if (!UUID.test(input.bookingId || '') || !String(input.reason || '').trim())
    throw new ValidationError('Valid bookingId and cancellation reason are required');
  return input;
}
module.exports = { validateHold, validateConfirmation, validateCancellation };
