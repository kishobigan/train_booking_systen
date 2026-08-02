'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NotificationService = require('../../../src/modules/notifications/notification.service');
const NotificationTemplateService = require('../../../src/modules/notifications/notification-template.service');
const TEMPLATE = require('../../../src/common/constants/notification-template.constants');
function createService(overrides = {}) {
  const records = [];
  const repository = {
    findByDeduplicationKey: async (key) => records.find((item) => item.deduplicationKey === key),
    create: async (values) => { const record = { id: `n-${records.length + 1}`, createdAt: new Date(), ...values }; records.push(record); return record; },
  };
  return { records, service: new NotificationService({
    notificationRepository: repository,
    notificationTemplateService: new NotificationTemplateService(),
    notificationPreferenceService: { isEnabled: async () => true },
    auditService: { record: async () => undefined },
    config: { enabled: true, maxAttempts: 5, retryBaseMinutes: 2, retryMaxMinutes: 60 },
    ...overrides,
  }) };
}
const variables = { customerName: 'Passenger', paymentReference: 'P-1', bookingReference: 'B-1', amount: '100', currency: 'LKR', paymentMethod: 'CARD', paymentDate: 'now', bookingStatus: 'CONFIRMED' };
test('queues normalized email and SMS without invoking a provider', async () => {
  const { service, records } = createService();
  await service.queueEmail({ destination: 'USER@Example.COM', templateCode: TEMPLATE.PAYMENT_SUCCESS, variables });
  await service.queueSms({ destination: '+94 77 000 0000', templateCode: TEMPLATE.PAYMENT_SUCCESS, variables });
  assert.equal(records[0].destination, 'user@example.com');
  assert.equal(records[1].destination, '+94770000000');
  assert.equal(records[0].status, 'PENDING');
});
test('rejects invalid destinations and returns an existing deduplicated record', async () => {
  const { service } = createService();
  await assert.rejects(() => service.queueEmail({ destination: 'bad', templateCode: TEMPLATE.PAYMENT_SUCCESS, variables }), /Invalid email/);
  const first = await service.queueEmail({ destination: 'a@example.com', templateCode: TEMPLATE.PAYMENT_SUCCESS, variables, deduplicationKey: 'payment:1:EMAIL' });
  const second = await service.queueEmail({ destination: 'a@example.com', templateCode: TEMPLATE.PAYMENT_SUCCESS, variables, deduplicationKey: 'payment:1:EMAIL' });
  assert.equal(second, first);
});
test('uses exponential retry delays with a maximum', () => {
  const { service } = createService();
  assert.equal(service.retryDelayMinutes(1), 2);
  assert.equal(service.retryDelayMinutes(2), 4);
  assert.equal(service.retryDelayMinutes(10), 60);
});
test('resolves booking contacts before user fallbacks', () => {
  const { service } = createService();
  assert.deepEqual(service.resolveDestinations({ user: { email: 'user@example.com', phoneNumber: '+94771111111' }, booking: { contactEmail: 'booking@example.com', contactPhone: '+94772222222' }, channels: ['EMAIL', 'SMS'] }), [
    { channel: 'EMAIL', destination: 'booking@example.com' },
    { channel: 'SMS', destination: '+94772222222' },
  ]);
});
