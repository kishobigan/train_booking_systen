'use strict';

process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5433/train_booking_test';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');
const FareCalculationService = require('../../../src/modules/fares/fare-calculation.service');
const FareRuleNotFoundError = require('../../../src/common/errors/FareRuleNotFoundError');
const InvalidJourneySegmentError = require('../../../src/common/errors/InvalidJourneySegmentError');
const FareCalculationError = require('../../../src/common/errors/FareCalculationError');

const IDS = Object.freeze({
  journey: '11111111-1111-4111-8111-111111111111',
  route: '22222222-2222-4222-8222-222222222222',
  origin: '33333333-3333-4333-8333-333333333333',
  destination: '44444444-4444-4444-8444-444444444444',
  journeySeat: '55555555-5555-4555-8555-555555555555',
  seat: '66666666-6666-4666-8666-666666666666',
  rule: '77777777-7777-4777-8777-777777777777',
});

function config(overrides = {}) {
  return {
    serviceFee: { type: 'PERCENTAGE', value: '2.50' },
    tax: { enabled: true, percentage: '5.00', includesServiceFee: true },
    maximumPassengersPerBooking: 6,
    ...overrides,
  };
}

function fixture({ classRule = {}, passengerRules, fareRule, customConfig } = {}) {
  const rule =
    fareRule === null
      ? null
      : {
          id: IDS.rule,
          routeId: IDS.route,
          name: 'Standard Fare',
          baseFare: '100.00',
          pricePerKm: '5.5000',
          minimumFare: '200.00',
          currency: 'LKR',
          validFrom: '2026-01-01',
          priority: 10,
          isActive: true,
          ...fareRule,
        };
  const discounts = passengerRules || [
    { passengerType: 'ADULT', discountPercentage: '0.00', isActive: true },
    { passengerType: 'CHILD', discountPercentage: '50.00', isActive: true },
    { passengerType: 'SENIOR', discountPercentage: '20.00', isActive: true },
  ];
  return new FareCalculationService({
    journeyRepository: {
      async findById(id) {
        return id === IDS.journey ? { id, routeId: IDS.route, journeyDate: '2026-09-01' } : null;
      },
    },
    journeyStationRepository: {
      async findOriginAndDestination(journeyId, originId, destinationId) {
        return [
          originId === IDS.origin
            ? {
                id: IDS.origin,
                journeyId,
                stationId: 'station-origin',
                sequenceNumber: 0,
                distanceFromStartKm: '0.00',
                canBoard: true,
                station: { code: 'FOT', name: 'Colombo Fort' },
              }
            : null,
          destinationId === IDS.destination
            ? {
                id: IDS.destination,
                journeyId,
                stationId: 'station-destination',
                sequenceNumber: 3,
                distanceFromStartKm: '120.00',
                canAlight: true,
                station: { code: 'KDT', name: 'Kandy' },
              }
            : null,
        ];
      },
    },
    journeySeatRepository: {
      async findByIdWithCoach(id) {
        return id === IDS.journeySeat
          ? {
              id,
              journeyId: IDS.journey,
              seatId: IDS.seat,
              seatNumberSnapshot: '1A',
              journeyCoach: {
                coachNumberSnapshot: 'R1',
                coachClassSnapshot: 'FIRST_CLASS',
              },
            }
          : null;
      },
    },
    fareRuleRepository: {
      async findHighestPriorityRule(routeId, journeyDate) {
        assert.equal(routeId, IDS.route);
        assert.equal(journeyDate, '2026-09-01');
        return rule;
      },
    },
    fareRuleClassRepository: {
      async findByFareRuleAndCoachClass() {
        return classRule === null ? null : { multiplier: '1.500', ...classRule };
      },
    },
    passengerFareRuleRepository: {
      async findActiveRules() {
        return discounts;
      },
      async findActiveByPassengerType(type) {
        return discounts.find((item) => item.passengerType === type) || null;
      },
    },
    config: customConfig || config(),
    clock: () => new Date('2026-08-01T00:00:00.000Z'),
  });
}

function quote(passengers = [{ passengerType: 'ADULT' }]) {
  return {
    journeyId: IDS.journey,
    originJourneyStationId: IDS.origin,
    destinationJourneyStationId: IDS.destination,
    journeySeatId: IDS.journeySeat,
    passengers,
  };
}

test('calculates cumulative distance and rejects invalid segment ordering and distance', () => {
  const service = fixture();
  assert.equal(
    service
      .calculateDistance(
        { id: 'a', sequenceNumber: 0, distanceFromStartKm: '10.25' },
        { id: 'b', sequenceNumber: 3, distanceFromStartKm: '130.25' }
      )
      .toFixed(2),
    '120.00'
  );
  assert.throws(
    () =>
      service.calculateDistance(
        { id: 'a', sequenceNumber: 1, distanceFromStartKm: '10' },
        { id: 'a', sequenceNumber: 1, distanceFromStartKm: '10' }
      ),
    InvalidJourneySegmentError
  );
  assert.throws(
    () =>
      service.calculateDistance(
        { id: 'a', sequenceNumber: 3, distanceFromStartKm: '100' },
        { id: 'b', sequenceNumber: 2, distanceFromStartKm: '120' }
      ),
    InvalidJourneySegmentError
  );
  assert.throws(
    () =>
      service.calculateDistance(
        { id: 'a', sequenceNumber: 1, distanceFromStartKm: '100' },
        { id: 'b', sequenceNumber: 2, distanceFromStartKm: '100' }
      ),
    InvalidJourneySegmentError
  );
});

test('resolves a journey-date fare rule and rejects a missing rule', async () => {
  assert.equal(
    (await fixture().resolveFareRule({ routeId: IDS.route, journeyDate: '2026-09-01' })).id,
    IDS.rule
  );
  await assert.rejects(
    () =>
      fixture({ fareRule: null }).resolveFareRule({
        routeId: IDS.route,
        journeyDate: '2026-09-01',
      }),
    FareRuleNotFoundError
  );
});

test('calculates decimal base fare, multiplier and minimum fare', () => {
  const service = fixture();
  assert.deepEqual(
    service.calculateBaseFare({ distanceKm: '120', baseFare: '100', pricePerKm: '5.5' }),
    {
      baseFare: '100.00',
      pricePerKm: '5.5000',
      distanceKm: '120.00',
      distanceCharge: '660.00',
      fareBeforeMultiplier: '760.00',
    }
  );
  assert.deepEqual(
    service.applyCoachMultiplier({ fareBeforeMultiplier: '760', multiplier: '1.5' }),
    {
      multiplier: '1.500',
      coachMultiplierAmount: '380.00',
      fareAfterMultiplier: '1140.00',
    }
  );
  assert.equal(
    service.applyMinimumFare({ calculatedFare: '140', minimumFare: '200' }).minimumFareApplied,
    true
  );
  assert.equal(
    service.applyMinimumFare({ calculatedFare: '240', minimumFare: '200' }).minimumFareApplied,
    false
  );
  assert.throws(
    () => service.applyCoachMultiplier({ fareBeforeMultiplier: '100', multiplier: '0' }),
    FareCalculationError
  );
});

test('uses class overrides and main-rule fallbacks', async () => {
  const fareRule = { id: IDS.rule, baseFare: '100', pricePerKm: '5', minimumFare: '50' };
  const overridden = await fixture({
    classRule: { baseFareOverride: '150', pricePerKmOverride: '7', minimumFareOverride: '90' },
  }).resolveCoachFareRule({ fareRule, coachClass: 'FIRST_CLASS' });
  assert.deepEqual(
    { base: overridden.baseFare, rate: overridden.pricePerKm, minimum: overridden.minimumFare },
    { base: '150', rate: '7', minimum: '90' }
  );
  const fallback = await fixture({ classRule: null }).resolveCoachFareRule({
    fareRule,
    coachClass: 'SECOND_CLASS',
  });
  assert.equal(fallback.multiplier, '1.000');
  assert.equal(fallback.pricePerKm, '5');
});

test('applies passenger discounts with optional zero fallback', async () => {
  const service = fixture();
  assert.equal(
    (
      await service.calculatePassengerDiscount({
        passengerType: 'CHILD',
        fareBeforeDiscount: '1000',
      })
    ).discountAmount,
    '500.00'
  );
  assert.equal(
    (
      await service.calculatePassengerDiscount({
        passengerType: 'SENIOR',
        fareBeforeDiscount: '1000',
      })
    ).fareAfterDiscount,
    '800.00'
  );
  assert.equal(
    (
      await service.calculatePassengerDiscount({
        passengerType: 'STUDENT',
        fareBeforeDiscount: '1000',
      })
    ).discountPercentage,
    '0.00'
  );
});

test('supports every service-fee policy', () => {
  const service = fixture();
  const input = { subtotalAfterDiscount: '1000', passengerCount: 2 };
  assert.equal(
    service.calculateServiceFee({
      ...input,
      serviceFeePolicy: { type: 'FIXED_PER_BOOKING', value: '50' },
    }).amount,
    '50.00'
  );
  assert.equal(
    service.calculateServiceFee({
      ...input,
      serviceFeePolicy: { type: 'FIXED_PER_PASSENGER', value: '25' },
    }).amount,
    '50.00'
  );
  assert.equal(
    service.calculateServiceFee({
      ...input,
      serviceFeePolicy: { type: 'PERCENTAGE', value: '2.5' },
    }).amount,
    '25.00'
  );
  assert.equal(
    service.calculateServiceFee({ ...input, serviceFeePolicy: { type: 'NONE', value: '0' } })
      .amount,
    '0.00'
  );
});

test('calculates configured tax and handles disabled tax', () => {
  const service = fixture();
  assert.equal(
    service.calculateTax({ taxableAmount: '1025', taxPolicy: { enabled: true, percentage: '5' } })
      .amount,
    '51.25'
  );
  assert.equal(
    service.calculateTax({ taxableAmount: '1025', taxPolicy: { enabled: false, percentage: '5' } })
      .amount,
    '0.00'
  );
});

test('returns the deterministic complete adult and child fare without floating-point errors', async () => {
  const result = await fixture().quoteFare(
    quote([{ passengerType: 'ADULT' }, { passengerType: 'CHILD' }])
  );
  assert.deepEqual(
    {
      passengerSubtotal: result.totals.passengerSubtotal,
      serviceFee: result.totals.serviceFee,
      taxAmount: result.totals.taxAmount,
      finalTotal: result.totals.finalTotal,
    },
    {
      passengerSubtotal: '1710.00',
      serviceFee: '42.75',
      taxAmount: '87.64',
      finalTotal: '1840.39',
    }
  );
  assert.equal(result.distanceKm, '120.00');
  assert.equal(result.fareRule.coachMultiplier, '1.500');
  assert.equal(result.passengers[1].discountAmount, '570.00');
  assert.equal(result.calculatedAt, '2026-08-01T00:00:00.000Z');
});
