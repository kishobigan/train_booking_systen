'use strict';
function socketError(error, fallbackCode = 'SEATMAP_INTERNAL_ERROR') {
  return {
    success: false,
    error: {
      code: error.code || fallbackCode,
      message:
        error.statusCode && error.statusCode < 500 ? error.message : 'Seat-map operation failed.',
    },
  };
}
module.exports = socketError;
