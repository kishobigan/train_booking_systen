'use strict';
const test = require('node:test');
test(
  'bank-slip flow requires migrated PostgreSQL integration environment',
  { skip: !process.env.RUN_DB_INTEGRATION },
  () => {}
);
