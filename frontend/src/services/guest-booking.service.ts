import { bookingAccessService } from './booking-access.service';

export const guestBookingService = {
  getGuestBooking: bookingAccessService.getCustomerActivity,
  getGuestTicket: bookingAccessService.getCustomerActivity,
};