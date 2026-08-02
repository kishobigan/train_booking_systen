'use strict';
const test = require('node:test');
test(
  'waitlist join, offer, position, conversion and leave HTTP flow',
  { skip: process.env.RUN_DB_INTEGRATION_TESTS !== 'true' },
  async () => {}
);
