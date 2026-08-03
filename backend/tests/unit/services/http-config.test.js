'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '../../..');

function authConfig(environment) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['-e', "process.stdout.write(JSON.stringify(require('./src/config/auth')))"],
      { cwd: backendRoot, env: environment, encoding: 'utf8' }
    )
  );
}

test('explicit local HTTP cookie setting is respected in production mode', () => {
  const config = authConfig({
    ...process.env,
    NODE_ENV: 'production',
    AUTH_COOKIE_SECURE: 'false',
    JWT_SECRET: 'test-only-secret',
  });
  assert.equal(config.cookie.secure, false);
});

test('production cookies default to secure without an explicit setting', () => {
  const environment = { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'test-only-secret' };
  delete environment.AUTH_COOKIE_SECURE;
  assert.equal(authConfig(environment).cookie.secure, true);
});

test('configured frontend origin is accepted by CORS', async () => {
  const previous = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3050';
  const modulePath = require.resolve('../../../src/config/cors');
  delete require.cache[modulePath];
  const config = require(modulePath);
  await new Promise((resolve, reject) => {
    config.origin('http://localhost:3050', (error, allowed) => {
      if (error) reject(error);
      else {
        assert.equal(allowed, true);
        resolve();
      }
    });
  });
  if (previous === undefined) delete process.env.CORS_ORIGINS;
  else process.env.CORS_ORIGINS = previous;
  delete require.cache[modulePath];
});
