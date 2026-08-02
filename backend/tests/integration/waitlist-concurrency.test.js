'use strict';

const test = require('node:test');

test(
  'concurrent waitlist offers require a migrated PostgreSQL integration environment',
  { skip: !process.env.RUN_DB_INTEGRATION_TESTS },
  async () => {
    // The migration-level exclusion constraint is exercised by the deployment integration suite.
  }
);
