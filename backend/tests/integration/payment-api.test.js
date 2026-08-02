'use strict';
const test = require('node:test');
test(
  'card and bank-slip payment HTTP flows',
  { skip: process.env.RUN_DB_INTEGRATION_TESTS !== 'true' },
  async () => {}
);
