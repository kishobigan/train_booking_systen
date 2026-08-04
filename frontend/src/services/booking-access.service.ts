import { apiClient } from './http/api-client';
import { unwrap } from './http/api-response';

export const bookingAccessService = {
  requestBookingAccess: async (input: Record<string, unknown>) =>
    unwrap<Record<string, any>>((await apiClient.post('/public/booking-access/request', input)).data),
  verifyBookingAccessOtp: async (input: Record<string, unknown>) =>
    unwrap<Record<string, any>>((await apiClient.post('/public/booking-access/verify', input)).data),
  getCustomerActivity: async () =>
    unwrap<Record<string, any>>((await apiClient.get('/public/booking-access/summary')).data),
  endGuestAccess: async () => unwrap<Record<string, any>>((await apiClient.post('/public/booking-access/end')).data),
};