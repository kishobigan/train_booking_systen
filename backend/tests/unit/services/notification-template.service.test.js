'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NotificationTemplateService = require('../../../src/modules/notifications/notification-template.service');
const TEMPLATE = require('../../../src/common/constants/notification-template.constants');
const service = new NotificationTemplateService();
const variables = {
  customerName: '<script>alert(1)</script>',
  bookingReference: 'BK-1',
  journeyName: 'EXP-1',
  originStation: 'Colombo',
  destinationStation: 'Kandy',
  departureTime: '2026-08-03T10:00:00Z',
  seatDetails: 'A-1',
  totalAmount: '1000.00',
  currency: 'LKR',
};
test('renders booking confirmation email and escapes unsafe HTML', () => {
  const result = service.renderEmail(TEMPLATE.BOOKING_CONFIRMATION, variables);
  assert.match(result.subject, /BK-1/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.doesNotMatch(result.html, /{{/);
});
test('renders booking confirmation SMS without unresolved placeholders', () => {
  const result = service.renderSms(TEMPLATE.BOOKING_CONFIRMATION, variables);
  assert.match(result.text, /BK-1/);
  assert.doesNotMatch(result.text, /{{/);
});
test('rejects unknown templates and missing variables', () => {
  assert.throws(() => service.renderEmail('UNKNOWN', {}), /not found/);
  assert.throws(() => service.renderEmail(TEMPLATE.BOOKING_CONFIRMATION, {}), /Missing/);
});
test('all event templates render with their required variables', () => {
  const samples = {
    [TEMPLATE.BOOKING_CANCELLATION]: {
      customerName: 'A',
      bookingReference: 'B',
      journeyName: 'J',
      cancelledAt: 'now',
      reason: 'requested',
      refundStatus: 'pending',
    },
    [TEMPLATE.WAITLIST_SEAT_OFFER]: {
      customerName: 'A',
      journeyName: 'J',
      originStation: 'O',
      destinationStation: 'D',
      seatDetails: '1 seat',
      offerExpiresAt: 'soon',
      actionUrl: 'https://example.com',
    },
    [TEMPLATE.PAYMENT_SUCCESS]: {
      customerName: 'A',
      paymentReference: 'P',
      bookingReference: 'B',
      amount: '1',
      currency: 'LKR',
      paymentMethod: 'CARD',
      paymentDate: 'now',
      bookingStatus: 'CONFIRMED',
    },
    [TEMPLATE.JOURNEY_DELAY]: {
      journeyName: 'J',
      previousDepartureTime: 'old',
      updatedDepartureTime: 'new',
      delayMinutes: 10,
      reason: 'weather',
    },
  };
  for (const [code, values] of Object.entries(samples)) {
    assert.doesNotMatch(service.renderEmail(code, values).html, /{{/);
    assert.doesNotMatch(service.renderSms(code, values).text, /{{/);
  }
});
