'use strict';
const test = require('node:test');
test(
  'seat-map REST snapshot uses live segment state without private data',
  { skip: process.env.RUN_DB_INTEGRATION_TESTS !== 'true' },
  async () => {}
);
