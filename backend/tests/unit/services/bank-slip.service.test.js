'use strict';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
const assert = require('node:assert/strict');
const test = require('node:test');
const BankSlipService = require('../../../src/modules/payments/bank-slip.service');
const BankSlipError = require('../../../src/common/errors/BankSlipError');
const service = new BankSlipService({});
test('validates actual PNG signature and rejects executable content', () => {
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(20)]);
  assert.equal(
    service.validateFile({ buffer: png, size: png.length, mimetype: 'image/png' }),
    true
  );
  assert.throws(
    () =>
      service.validateFile({ buffer: Buffer.from('#!/bin/sh'), size: 9, mimetype: 'image/png' }),
    BankSlipError
  );
});
