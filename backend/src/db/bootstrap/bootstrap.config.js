'use strict';

const { loadSeedConfig } = require('../seeds/config');

function loadBootstrapConfig() {
  const seed = loadSeedConfig();
  return {
    ...seed,
    apiBaseUrl: (process.env.BOOTSTRAP_API_BASE_URL || 'http://127.0.0.1:4050/api/v1').replace(/\/$/, ''),
    requestTimeoutMs: Number(process.env.BOOTSTRAP_REQUEST_TIMEOUT_MS || 15000),
    retryAttempts: Number(process.env.BOOTSTRAP_RETRY_ATTEMPTS || 20),
    retryDelayMs: Number(process.env.BOOTSTRAP_RETRY_DELAY_MS || 1500),
  };
}

module.exports = { loadBootstrapConfig };
