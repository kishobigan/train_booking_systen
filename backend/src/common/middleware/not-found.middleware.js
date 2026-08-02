'use strict';

const NotFoundError = require('../errors/NotFoundError');
const ERROR_CODES = require('../constants/error-codes.constants');

function notFoundMiddleware(req, res, next) {
  const error = new NotFoundError('API route not found', {
    method: req.method,
    path: req.originalUrl,
  });
  error.code = ERROR_CODES.ROUTE_NOT_FOUND;
  next(error);
}

module.exports = notFoundMiddleware;
