import { describe, expect, it } from 'vitest';
import { bookingSchema } from './booking.schema';
const passenger = {
  passengerNumber: 1,
  fullName: 'Test Passenger',
  passengerType: 'ADULT',
  identityType: 'NIC',
  identityNumber: '200012345678',
  identityCountry: 'LKA',
  dateOfBirth: '2000-01-01',
  journeySeatId: '11111111-1111-4111-8111-111111111111',
};
describe('booking validation', () => {
  it('requires contact details and policy acceptance', () =>
    expect(
      bookingSchema.safeParse({
        passengers: [passenger],
        contact: { fullName: 'Contact', email: '', phone: '' },
        policyAccepted: false,
      }).success,
    ).toBe(false));
  it('accepts a safe passenger booking draft', () =>
    expect(
      bookingSchema.safeParse({
        passengers: [passenger],
        contact: { fullName: 'Contact', email: 'contact@example.com', phone: '' },
        policyAccepted: true,
      }).success,
    ).toBe(true));
});
