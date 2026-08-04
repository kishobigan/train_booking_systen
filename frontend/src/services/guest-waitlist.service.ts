import { bookingAccessService } from './booking-access.service';

export const guestWaitlistService = {
  getGuestWaitlist: bookingAccessService.getCustomerActivity,
  joinWaitlist: async (input: Record<string, unknown>) => bookingAccessService.requestBookingAccess(input),
  leaveWaitlist: async () => bookingAccessService.endGuestAccess(),
  acceptWaitlistOffer: async () => bookingAccessService.endGuestAccess(),
  declineWaitlistOffer: async () => bookingAccessService.endGuestAccess(),
};