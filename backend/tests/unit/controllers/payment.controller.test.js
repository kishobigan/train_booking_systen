'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const PaymentController = require('../../../src/modules/payments/payment.controller');
const { response, invoke, UUID } = require('./test-helpers');
test('payment controller creates payment without accepting client amount', async () => {
  let input;
  const controller = new PaymentController({
    paymentService: {
      createPayment: async (value) => {
        input = value;
        return { paymentId: UUID };
      },
    },
  });
  const res = response();
  await invoke(
    controller.create,
    {
      params: { bookingId: UUID },
      user: { id: UUID, role: 'PASSENGER' },
      body: { method: 'CARD', amount: '0.01' },
      get: () => 'key',
    },
    res
  );
  assert.equal(input.amount, undefined);
  assert.equal(res.statusCode, 201);
});
