'use strict';

const AppError = require('../errors/AppError');
const ValidationError = require('../errors/ValidationError');
const ConflictError = require('../errors/ConflictError');
const ERROR_CODES = require('../constants/error-codes.constants');
const logger = require('../../config/logger');

function normalizeError(error) {
  if (error instanceof AppError) return error;

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    const invalidJsonError = new ValidationError('Request body contains invalid JSON', undefined, {
      cause: error,
    });
    invalidJsonError.code = ERROR_CODES.INVALID_JSON;
    return invalidJsonError;
  }

  if (error.name === 'SequelizeValidationError') {
    return new ValidationError(
      'Database validation failed',
      error.errors?.map(({ path, message }) => ({ field: path, message })),
      { cause: error }
    );
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return new ConflictError('A resource with these values already exists', undefined, {
      cause: error,
    });
  }

  return error;
}

function errorHandlerMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  const normalizedError = normalizeError(error);
  const isOperational = normalizedError instanceof AppError && normalizedError.isOperational;
  const statusCode = isOperational ? normalizedError.statusCode : 500;
  const requestLogger = req.log || logger;

  const logContext = {
    err: error,
    code: isOperational ? normalizedError.code : ERROR_CODES.INTERNAL_SERVER_ERROR,
    method: req.method,
    path: req.originalUrl,
  };

  if (statusCode >= 500) {
    requestLogger.error(logContext, 'Request failed');
  } else {
    requestLogger.warn(logContext, 'Request rejected');
  }

  const responseError = {
    code: isOperational ? normalizedError.code : ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: isOperational ? normalizedError.message : 'Internal server error',
  };

  if (isOperational && normalizedError.details !== undefined) {
    responseError.details = normalizedError.details;
  }

  return res.status(statusCode).json({ error: responseError });
}

module.exports = errorHandlerMiddleware;
module.exports.normalizeError = normalizeError;
