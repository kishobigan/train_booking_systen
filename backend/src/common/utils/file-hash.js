'use strict';
const { createHash } = require('node:crypto');
module.exports = (buffer) => createHash('sha256').update(buffer).digest('hex');
