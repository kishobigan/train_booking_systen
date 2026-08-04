'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { usePendingBankSlips } from '@/hooks/api/admin/usePendingBankSlips';
import { useAdminContext } from '@/hooks/api/admin/useAdminContext';
import { adminPaymentService } from '@/services/admin/payment-admin.service';

type Slip = Record<string, any>;

export function PendingBankSlipsView() {
  const pendingSlips = usePendingBankSlips();
  const { mode } = useAdminContext();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['payments', 'bank-slips', 'pending', mode] });
  const approve = useMutation({
    mutationFn: ({ paymentId, note }: { paymentId: string; note: string }) =>
      adminPaymentService.approve(mode, paymentId, note, createIdempotencyKey()),
    onSuccess: refresh,
    onError: (requestError: Error) => setError(requestError.message),
  });
  const reject = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      adminPaymentService.reject(mode, paymentId, reason, createIdempotencyKey()),
    onSuccess: refresh,
    onError: (requestError: Error) => setError(requestError.message),
  });
  const download = useMutation({
    mutationFn: (paymentId: string) => adminPaymentService.downloadSlip(mode, paymentId),
    onSuccess: (response) => {
      const contentType = response.headers['content-type'];
      downloadFile(response.data, typeof contentType === 'string' ? contentType : undefined);
    },
    onError: (requestError: Error) => setError(requestError.message),
  });

  const review = (slip: Slip) => {
    const note = window.prompt('Optional approval note for this payment:') ?? '';
    if (window.confirm(`Approve payment ${slip.paymentReference || slip.paymentId}? This confirms the booking.`)) {
      setError(null);
      approve.mutate({ paymentId: slip.paymentId, note });
    }
  };
  const rejectSlip = (slip: Slip) => {
    const reason = window.prompt('Enter the reason for rejecting this bank slip:')?.trim();
    if (!reason) return;
    setError(null);
    reject.mutate({ paymentId: slip.paymentId, reason });
  };

  return (
    <div className="stack">
      <div>
        <h1>Pending bank slips</h1>
        <p className="muted">Review the uploaded proof of payment, then approve to confirm the customer’s booking.</p>
      </div>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <DataTable
        caption="Pending bank slips"
        loading={pendingSlips.isLoading}
        error={pendingSlips.error}
        retry={() => pendingSlips.refetch()}
        rows={pendingSlips.data}
        emptyMessage="No bank slips are awaiting review."
        columns={[
          { key: 'reference', header: 'Payment', cell: (slip: Slip) => slip.paymentReference || slip.paymentId },
          { key: 'booking', header: 'Booking', cell: (slip: Slip) => slip.bookingReference || slip.bookingId || '—' },
          { key: 'amount', header: 'Amount', cell: (slip: Slip) => `${slip.currency || 'LKR'} ${slip.amount || slip.submittedAmount || '—'}` },
          { key: 'depositor', header: 'Depositor', cell: (slip: Slip) => slip.depositorName || '—', hideOnMobile: true },
          { key: 'transfer', header: 'Transfer date', cell: (slip: Slip) => formatDate(slip.transferDate || slip.uploadedAt), hideOnMobile: true },
          {
            key: 'actions',
            header: 'Review',
            cell: (slip: Slip) => (
              <div className="table-actions">
                <button className="button button-secondary" type="button" disabled={download.isPending} onClick={() => download.mutate(slip.paymentId)}>Download slip</button>
                <button className="button" type="button" disabled={approve.isPending || reject.isPending} onClick={() => review(slip)}>Approve</button>
                <button className="button button-secondary" type="button" disabled={approve.isPending || reject.isPending} onClick={() => rejectSlip(slip)}>Reject</button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function downloadFile(blob: Blob, contentType?: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: contentType || blob.type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'bank-slip';
  anchor.click();
  URL.revokeObjectURL(url);
}
