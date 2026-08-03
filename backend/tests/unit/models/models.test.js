'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DataTypes } = require('sequelize');
const models = require('../../../src/models');

test('all migration-backed models load with the correct tables', () => {
  assert.equal(Object.keys(models).length, 34);
  assert.equal(models.AdminTrainAssignment.tableName, 'admin_train_assignments');
  assert.equal(models.AdminJourney.tableName, 'admin_journeys');
  assert.equal(models.StaffStation.tableName, 'staff_stations');
  assert.equal(models.BankPaymentSlip.tableName, 'bank_payment_slips');
  assert.equal(models.IdempotencyRecord.tableName, 'idempotency_records');
  assert.equal(models.PaymentReconciliationLog.tableName, 'payment_reconciliation_logs');
  assert.equal(models.User.getTableName(), 'users');
  assert.equal(models.ActiveSeatAllocation.getTableName(), 'active_seat_allocations');
  assert.equal(models.JourneyDisruption.getTableName(), 'journey_disruptions');
  assert.equal(models.JobExecution.getTableName(), 'job_executions');
});

test('model-owned associations expose the documented aliases and foreign keys', () => {
  assert.equal(models.Route.associations.routeStations.foreignKey, 'routeId');
  assert.equal(models.Route.associations.startStation.foreignKey, 'startStationId');
  assert.equal(models.Train.associations.coaches.foreignKey, 'trainId');
  assert.equal(models.Booking.associations.passengers.foreignKey, 'bookingId');
  assert.equal(models.Booking.associations.payments.foreignKey, 'bookingId');
});

test('user serialization never exposes password hashes', () => {
  const user = models.User.build({
    passwordHash: 'secret',
    fullName: 'Test',
    email: 'test@example.com',
  });
  assert.equal(user.toJSON().passwordHash, undefined);
});

test('model-specific PostgreSQL and financial types are preserved', () => {
  assert(models.Journey.rawAttributes.journeyDate.type instanceof DataTypes.DATEONLY);
  assert.equal(models.Payment.rawAttributes.amount.type.key, 'DECIMAL');
  assert.equal(models.Coach.rawAttributes.seatLayout.type.key, 'JSONB');
  assert.equal(models.BookingSeat.rawAttributes.occupiedSegment.type.key, 'RANGE');
});

test('booking state helpers work without database access', () => {
  const active = models.Booking.build({ status: 'CONFIRMED' });
  const expired = models.Booking.build({
    status: 'HELD',
    holdExpiresAt: new Date(Date.now() - 1000),
  });
  assert.equal(active.isConfirmed(), true);
  assert.equal(expired.isHoldExpired(), true);
});
