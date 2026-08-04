import { apiClient } from '@/services/http/api-client';
import { unwrap } from '@/services/http/api-response';
import { AdminMode } from './dashboard.service';

export const adminPaymentService = {
  pendingSlips: async (mode: AdminMode) =>
    unwrap<any[]>((await apiClient.get(`/${mode}/payments/bank-slips/pending`)).data),
  approve: async (mode: AdminMode, paymentId: string, verificationNote: string, key: string) =>
    unwrap(
      (
        await apiClient.post(
          `/${mode}/payments/${paymentId}/bank-slip/approve`,
          { verificationNote: verificationNote || undefined },
          { headers: { 'Idempotency-Key': key } }
        )
      ).data
    ),
  reject: async (mode: AdminMode, paymentId: string, reason: string, key: string) =>
    unwrap(
      (
        await apiClient.post(
          `/${mode}/payments/${paymentId}/bank-slip/reject`,
          { reason },
          { headers: { 'Idempotency-Key': key } }
        )
      ).data
    ),
  downloadSlip: async (mode: AdminMode, paymentId: string) =>
    apiClient.get(`/${mode}/payments/${paymentId}/bank-slip/download`, { responseType: 'blob' }),
};
