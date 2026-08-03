import { describe, expect, it } from 'vitest';
import { journeySearchSchema } from './journey-search.schema';
const origin = '11111111-1111-4111-8111-111111111111',
  destination = '22222222-2222-4222-8222-222222222222';
describe('journey search validation', () => {
  it('accepts a shareable valid search', () =>
    expect(
      journeySearchSchema.safeParse({
        originStationId: origin,
        destinationStationId: destination,
        date: '2026-08-15',
        passengerCount: '2',
      }).success,
    ).toBe(true));
  it('rejects the same origin and destination', () =>
    expect(
      journeySearchSchema.safeParse({
        originStationId: origin,
        destinationStationId: origin,
        date: '2026-08-15',
        passengerCount: 1,
      }).success,
    ).toBe(false));
  it('limits passenger counts', () =>
    expect(
      journeySearchSchema.safeParse({
        originStationId: origin,
        destinationStationId: destination,
        date: '2026-08-15',
        passengerCount: 7,
      }).success,
    ).toBe(false));
});
describe('coach class validation', () => {
  it('accepts backend enum values', () =>
    expect(
      journeySearchSchema.safeParse({
        originStationId: origin,
        destinationStationId: destination,
        date: '2026-08-15',
        passengerCount: 1,
        coachClass: 'FIRST_CLASS',
      }).success,
    ).toBe(true));
  it('rejects display-only values', () =>
    expect(
      journeySearchSchema.safeParse({
        originStationId: origin,
        destinationStationId: destination,
        date: '2026-08-15',
        passengerCount: 1,
        coachClass: 'FIRST',
      }).success,
    ).toBe(false));
});
