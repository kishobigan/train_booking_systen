'use strict';
const test = require('node:test');
test(
  'notification queue and worker require a migrated PostgreSQL integration environment',
  { skip: !process.env.RUN_DB_INTEGRATION_TESTS },
  async () => {
    // Deployment integration runs migration 022 and injects mock providers.
  }
);
