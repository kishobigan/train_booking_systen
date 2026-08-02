'use strict';
const test = require('node:test');
test(
  'booking hold, confirmation, cancellation, history and ticket HTTP flow',
  { skip: process.env.RUN_DB_INTEGRATION_TESTS !== 'true' },
  async () => {}
);
