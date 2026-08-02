'use strict';
const test = require('node:test');
test(
  'refund flow requires migrated PostgreSQL integration environment',
  { skip: !process.env.RUN_DB_INTEGRATION },
  () => {}
);
