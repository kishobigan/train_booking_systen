'use strict';
const BookingConflictError = require('../errors/BookingConflictError');
const ConflictError = require('../errors/ConflictError');
const ValidationError = require('../errors/ValidationError');
function postgresCode(error) {
  return error?.original?.code || error?.parent?.code || error?.code;
}
function mapDatabaseError(error) {
  const code = postgresCode(error);
  if (code === '23P01')
    return new BookingConflictError(
      'A selected seat conflicts with an existing booking',
      undefined,
      { cause: error }
    );
  if (code === '23505')
    return new ConflictError('A unique booking value already exists', undefined, { cause: error });
  if (code === '23503')
    return new ValidationError('A referenced booking resource does not exist', undefined, {
      cause: error,
    });
  return error;
}
function isTransientTransactionError(error) {
  return ['40001', '40P01'].includes(postgresCode(error));
}
module.exports = { postgresCode, mapDatabaseError, isTransientTransactionError };
