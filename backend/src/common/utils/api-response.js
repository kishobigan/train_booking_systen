'use strict';
function success(data, meta) {
  return { success: true, data, ...(meta !== undefined && { meta }) };
}
module.exports = { success };
