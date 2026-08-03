'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/StatusState';
import { BookingHoldTimer } from '@/components/bookings/BookingHoldTimer';
import { StripePaymentForm } from './StripePaymentForm';
import { getUserError } from '@/utils/user-error';
import { paymentService } from '@/services/payment.service';
import { useBookingDetails } from '@/hooks/api/useBookingDetails';
import { useCreatePayment, usePaymentStatus } from '@/hooks/api/usePayment';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { usePaymentFlowStore } from '@/store/payment-flow.store';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function PaymentPageView({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const booking = useBookingDetails(bookingId);
  const createPayment = useCreatePayment();
  const paymentFlow = usePaymentFlowStore();
  const idempotency = useIdempotencyKey();
  const status = usePaymentStatus(paymentFlow.paymentId);
  const [response, setResponse] = useState<Record<string, any> | null>(null);
  const [uploading, setUploading] = useState(false);
  const cardAvailable = Boolean(stripePromise);
  const selectedMethod = cardAvailable ? paymentFlow.method : 'BANK_SLIP';

  if (booking.isLoading) return <LoadingState label="Loading secure payment details…" />;
  if (booking.isError) {
    return <ErrorState message={booking.error.message} retry={() => booking.refetch()} />;
  }

  const data = booking.data!;
  if (['CONFIRMED', 'COMPLETED'].includes(data.status)) {
    router.replace(`/booking/${bookingId}/ticket`);
    return <LoadingState label="Opening your ticket…" />;
  }

  const expired = ['EXPIRED', 'CANCELLED', 'REFUNDED'].includes(data.status);
  const start = async () => {
    try {
      const result = await createPayment.mutateAsync({
        bookingId,
        method: selectedMethod,
        key: idempotency.key,
      });
      setResponse(result);
      paymentFlow.setPaymentId(result.paymentId);
    } catch {
      // React Query exposes the normalized error below the action button.
    }
  };
  const upload = async (file?: File) => {
    if (!file || !paymentFlow.paymentId) return;
    setUploading(true);
    try {
      await paymentService.uploadBankSlip(paymentFlow.paymentId, file);
      await status.refetch();
    } finally {
      setUploading(false);
    }
  };

  if (status.data?.status === 'PAID') router.replace(`/booking/${bookingId}/ticket`);

  return (
    <div className="shell">
      <div className="page-heading">
        <h1>Complete payment</h1>
        <p className="muted">Booking {data.bookingReference}</p>
      </div>
      <div className="payment-layout">
        <Card>
          <h2>Payment method</h2>
          <div className="method-tabs">
            {cardAvailable && (
              <button
                className={selectedMethod === 'CARD' ? 'active' : ''}
                onClick={() => paymentFlow.setMethod('CARD')}
              >
                Card
              </button>
            )}
            <button
              className={selectedMethod === 'BANK_SLIP' ? 'active' : ''}
              onClick={() => paymentFlow.setMethod('BANK_SLIP')}
            >
              Bank slip
            </button>
          </div>
          {!cardAvailable && (
            <p className="muted">Card payment is unavailable in this local environment.</p>
          )}
          {!response && (
            <button
              className="button"
              disabled={expired || createPayment.isPending}
              onClick={start}
            >
              {createPayment.isPending ? 'Preparing payment…' : 'Continue with bank slip'}
            </button>
          )}
          {createPayment.error && <div className="form-alert">{getUserError(createPayment.error)}</div>}
          {selectedMethod === 'CARD' && response?.stripe?.clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret: response.stripe.clientSecret }}>
              <StripePaymentForm onProcessing={() => status.refetch()} />
            </Elements>
          )}
          {selectedMethod === 'BANK_SLIP' && response && (
            <div className="stack">
              <div className="bank-instructions">
                <b>{response.bankInstructions?.bankName}</b>
                <span>{response.bankInstructions?.accountName}</span>
                <span>Account: {response.bankInstructions?.accountNumber}</span>
                <span>Reference: {response.bankInstructions?.transferReference}</span>
              </div>
              <label className="field">
                Upload JPEG, PNG, or PDF
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  disabled={uploading}
                  onChange={(event) => upload(event.target.files?.[0])}
                />
              </label>
            </div>
          )}
        </Card>
        <aside className="stack">
          <Card>
            <h2>Payment summary</h2>
            <p className="fare-total">{data.currency} {data.totalAmount}</p>
            <BookingHoldTimer expiresAt={data.holdExpiresAt} onExpire={() => booking.refetch()} />
          </Card>
          {paymentFlow.paymentId && (
            <Card aria-live="polite">
              <h2>Payment status</h2>
              <span className="badge">{status.data?.status || 'Checking…'}</span>
              <p className="muted">Confirmation comes from the booking server, not the browser payment response.</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
