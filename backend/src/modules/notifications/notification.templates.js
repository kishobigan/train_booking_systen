'use strict';
const TEMPLATE = require('../../common/constants/notification-template.constants');
module.exports = Object.freeze({
  [TEMPLATE.BOOKING_CONFIRMATION]: {
    requiredVariables: [
      'customerName',
      'bookingReference',
      'journeyName',
      'originStation',
      'destinationStation',
      'departureTime',
      'seatDetails',
      'totalAmount',
      'currency',
    ],
    email: {
      subject: 'Booking confirmed: {{bookingReference}}',
      text: 'Hello {{customerName}}, booking {{bookingReference}} is confirmed for {{journeyName}}, {{originStation}} to {{destinationStation}} at {{departureTime}}. Seats: {{seatDetails}}. Total: {{currency}} {{totalAmount}}.',
      html: '<h1>Booking confirmed</h1><p>Hello {{customerName}},</p><p>Booking <strong>{{bookingReference}}</strong> is confirmed.</p><p>{{journeyName}}: {{originStation}} to {{destinationStation}}, departing {{departureTime}}.</p><p>Seats: {{seatDetails}}. Total: {{currency}} {{totalAmount}}.</p>',
    },
    sms: {
      text: 'Booking {{bookingReference}} confirmed. {{originStation}} to {{destinationStation}}, {{departureTime}}. Seats {{seatDetails}}.',
    },
  },
  [TEMPLATE.BOOKING_CANCELLATION]: {
    requiredVariables: [
      'customerName',
      'bookingReference',
      'journeyName',
      'cancelledAt',
      'reason',
      'refundStatus',
    ],
    email: {
      subject: 'Booking cancelled: {{bookingReference}}',
      text: 'Hello {{customerName}}, booking {{bookingReference}} for {{journeyName}} was cancelled at {{cancelledAt}}. Reason: {{reason}}. Refund: {{refundStatus}}.',
      html: '<h1>Booking cancelled</h1><p>Hello {{customerName}}, booking <strong>{{bookingReference}}</strong> for {{journeyName}} was cancelled at {{cancelledAt}}.</p><p>Reason: {{reason}}. Refund: {{refundStatus}}.</p>',
    },
    sms: {
      text: 'Booking {{bookingReference}} cancelled. Reason: {{reason}}. Refund: {{refundStatus}}.',
    },
  },
  [TEMPLATE.WAITLIST_SEAT_OFFER]: {
    requiredVariables: [
      'customerName',
      'journeyName',
      'originStation',
      'destinationStation',
      'seatDetails',
      'offerExpiresAt',
      'actionUrl',
    ],
    email: {
      subject: 'A seat is available for your journey',
      text: 'Hello {{customerName}}, {{seatDetails}} is available for {{journeyName}}, {{originStation}} to {{destinationStation}}. Accept before {{offerExpiresAt}} at {{actionUrl}}.',
      html: '<h1>A seat is available</h1><p>Hello {{customerName}}, {{seatDetails}} is available for {{journeyName}}, {{originStation}} to {{destinationStation}}.</p><p>Accept before {{offerExpiresAt}} at <a href="{{actionUrl}}">your booking account</a>.</p>',
    },
    sms: {
      text: 'A seat is available for {{originStation}} to {{destinationStation}}. Accept before {{offerExpiresAt}}: {{actionUrl}}',
    },
  },
  [TEMPLATE.BOOKING_ACCESS_OTP]: {
    requiredVariables: ['customerName', 'otpCode', 'expiresAt'],
    email: {
      subject: 'Your booking access verification code',
      text: 'Hello {{customerName}}, your booking access verification code is {{otpCode}}. It expires at {{expiresAt}}.',
      html: '<h1>Your booking access code</h1><p>Hello {{customerName}},</p><p>Your verification code is <strong>{{otpCode}}</strong>.</p><p>It expires at {{expiresAt}}.</p>',
    },
    sms: {
      text: 'Your booking access code is {{otpCode}}. It expires at {{expiresAt}}.',
    },
  },
  [TEMPLATE.PAYMENT_SUCCESS]: {
    requiredVariables: [
      'customerName',
      'paymentReference',
      'bookingReference',
      'amount',
      'currency',
      'paymentMethod',
      'paymentDate',
      'bookingStatus',
    ],
    email: {
      subject: 'Payment received: {{paymentReference}}',
      text: 'Hello {{customerName}}, payment {{paymentReference}} for booking {{bookingReference}} was received. {{currency}} {{amount}} by {{paymentMethod}} on {{paymentDate}}. Booking status: {{bookingStatus}}.',
      html: '<h1>Payment received</h1><p>Hello {{customerName}}, payment <strong>{{paymentReference}}</strong> for booking {{bookingReference}} was received.</p><p>{{currency}} {{amount}} by {{paymentMethod}} on {{paymentDate}}. Booking status: {{bookingStatus}}.</p>',
    },
    sms: {
      text: 'Payment {{paymentReference}} received for booking {{bookingReference}}: {{currency}} {{amount}}.',
    },
  },
  [TEMPLATE.JOURNEY_DELAY]: {
    requiredVariables: [
      'journeyName',
      'previousDepartureTime',
      'updatedDepartureTime',
      'delayMinutes',
      'reason',
    ],
    email: {
      subject: 'Journey delayed: {{journeyName}}',
      text: '{{journeyName}} is delayed by {{delayMinutes}} minutes. Previous departure: {{previousDepartureTime}}. New departure: {{updatedDepartureTime}}. Reason: {{reason}}.',
      html: '<h1>Journey delayed</h1><p>{{journeyName}} is delayed by {{delayMinutes}} minutes.</p><p>Previous departure: {{previousDepartureTime}}. New departure: {{updatedDepartureTime}}. Reason: {{reason}}.</p>',
    },
    sms: {
      text: '{{journeyName}} delayed {{delayMinutes}} min. New departure {{updatedDepartureTime}}. {{reason}}',
    },
  },
});
