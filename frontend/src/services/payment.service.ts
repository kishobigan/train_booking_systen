import { apiClient } from './http/api-client';
import { unwrap } from './http/api-response';
export const paymentService = {
  createPayment: async (bookingId: string, method: 'CARD' | 'BANK_SLIP', key: string) =>
    unwrap<Record<string, any>>(
      (
        await apiClient.post(
          `/guest/bookings/${bookingId}/payments`,
          { method },
          { headers: { 'Idempotency-Key': key } },
        )
      ).data,
    ),
  getPayment: async (id: string) =>
    unwrap<Record<string, any>>((await apiClient.get(`/guest/payments/${id}`)).data),
  getPaymentStatus: async (id: string) =>
    unwrap<Record<string, any>>((await apiClient.get(`/guest/payments/${id}/status`)).data),
  verifyPaymentStatus: async (id: string) =>
    unwrap((await apiClient.post(`/guest/payments/${id}/verify`)).data),
  uploadBankSlip: async (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return unwrap((await apiClient.post(`/guest/payments/${id}/bank-slip`, body)).data);
  },
};
