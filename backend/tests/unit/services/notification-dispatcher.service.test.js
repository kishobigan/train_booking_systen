'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NotificationDispatcherService = require('../../../src/modules/notifications/notification-dispatcher.service');
test('dispatches email and SMS through their configured providers', async () => {
  const calls = [];
  const dispatcher = new NotificationDispatcherService({
    emailProvider: {
      name: 'EMAIL_TEST',
      send: async (input) => {
        calls.push(input);
        return { success: true, providerReference: 'email-1' };
      },
    },
    smsProvider: {
      name: 'SMS_TEST',
      send: async (input) => {
        calls.push(input);
        return { success: true, providerReference: 'sms-1' };
      },
    },
  });
  assert.equal(
    (
      await dispatcher.dispatch({
        channel: 'EMAIL',
        destination: 'a@example.com',
        subject: 'S',
        content: 'T',
        metadata: { html: '<p>T</p>' },
      })
    ).providerName,
    'EMAIL_TEST'
  );
  assert.equal(
    (
      await dispatcher.dispatch({
        channel: 'SMS',
        destination: '+94770000000',
        content: 'T',
        metadata: {},
      })
    ).providerName,
    'SMS_TEST'
  );
  assert.equal(calls.length, 2);
});
test('rejects unsupported channels', async () => {
  const dispatcher = new NotificationDispatcherService({});
  await assert.rejects(() => dispatcher.dispatch({ channel: 'PUSH' }), /Unsupported/);
});
