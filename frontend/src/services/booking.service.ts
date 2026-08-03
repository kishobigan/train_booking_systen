import { apiClient } from './http/api-client';
import { unwrap } from './http/api-response';
export const bookingService = {
  createBookingHold: async (input: unknown, idempotencyKey: string) => {
    void idempotencyKey;
    return unwrap<Record<string, any>>((await apiClient.post('/bookings/hold', input)).data);
  },
  getBookingDetails: async (id: string) =>
    unwrap<Record<string, any>>((await apiClient.get(`/guest/bookings/${id}`)).data),
  getBookingHistory: async (id: string) =>
    unwrap<any[]>((await apiClient.get(`/guest/bookings/${id}/history`)).data),
  cancelBooking: async (id: string, reason: string) =>
    unwrap((await apiClient.post(`/guest/bookings/${id}/cancel`, { reason })).data),
  getTicket: async (id: string) =>
    unwrap<Record<string, any>>((await apiClient.get(`/guest/bookings/${id}/ticket`)).data),
};
