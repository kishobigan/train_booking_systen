'use strict';
const ValidationError = require('../../common/errors/ValidationError');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function notificationId(value) {
  if (!UUID.test(value || '')) throw new ValidationError('notificationId must be a valid UUID');
  return value;
}
module.exports = { notificationId };
