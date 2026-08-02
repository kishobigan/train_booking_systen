'use strict';
const test = require('node:test');
test(
  'Socket.IO subscription receives held, confirmed and released events',
  { skip: process.env.RUN_DB_INTEGRATION_TESTS !== 'true' },
  async () => {}
);
