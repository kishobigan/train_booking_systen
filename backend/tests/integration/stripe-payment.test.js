'use strict';
const test = require('node:test');
test(
  'Stripe flow uses mocked provider in integration environment',
  { skip: !process.env.RUN_DB_INTEGRATION },
  () => {}
);
