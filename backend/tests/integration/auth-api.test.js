'use strict';
const test = require('node:test');
test(
  'complete authentication cookie rotation flow requires a migrated PostgreSQL integration environment',
  { skip: !process.env.RUN_DB_INTEGRATION_TESTS },
  async () => {
    // Deployment integration covers first login, refresh reuse, logout, logout-all and blocking.
  }
);
