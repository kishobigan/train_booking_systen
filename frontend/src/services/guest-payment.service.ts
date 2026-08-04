import { bookingAccessService } from './booking-access.service';

export const guestPaymentService = {
  getGuestPaymentStatus: bookingAccessService.getCustomerActivity,
};