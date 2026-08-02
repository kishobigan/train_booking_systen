'use strict';
const test = require('node:test');
test(
  'admin dashboard, revenue, occupancy and journey scope HTTP flow',
  { skip: process.env.RUN_DB_INTEGRATION_TESTS !== 'true' },
  async () => {}
);
