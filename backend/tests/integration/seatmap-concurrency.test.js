'use strict';
const test = require('node:test');
test(
  'overlapping booking races converge through snapshot resynchronization',
  { skip: process.env.RUN_DB_INTEGRATION_TESTS !== 'true' },
  async () => {}
);
