'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatusState';
import { useBookingAccessOtpVerification, useBookingAccessRequest, useCustomerActivity } from '@/hooks/api/useBookingAccess';
import { useGuestBookingAccessStore } from '@/store/guest-booking-access.store';
import { queryKeys } from '@/constants/query-keys';

type RequestValues = { primaryNic: string; bookingReference: string; contact: string; otp: string };

export function BookingAccessPageView() {
  const queryClient = useQueryClient();
  const access = useGuestBookingAccessStore();
  const request = useBookingAccessRequest();
  const verify = useBookingAccessOtpVerification();
  const activity = useCustomerActivity(true);
  const requestForm = useForm<RequestValues>({ defaultValues: { primaryNic: '', bookingReference: '', contact: '', otp: '' } });
  const otpForm = useForm<RequestValues>({ defaultValues: { primaryNic: '', bookingReference: '', contact: '', otp: '' } });

  const hasVerifiedSession = Boolean(access.verified || activity.data);

  const submitRequest = requestForm.handleSubmit(async (values) => {
    const contact = values.contact.trim();
    const payload = {
      primaryNic: values.primaryNic,
      bookingReference: values.bookingReference || undefined,
      contact: contact ? { email: contact.includes('@') ? contact : undefined, phone: contact.includes('@') ? undefined : contact } : undefined,
    };
    const result = await request.mutateAsync(payload);
    access.setRequest({ requestId: result.requestId });
  });

  const submitOtp = otpForm.handleSubmit(async (values) => {
    const result = await verify.mutateAsync({ requestId: access.requestId, otp: values.otp });
    access.setVerified({ bookingId: result.bookingId, expiresAt: result.guestAccessTokenExpiresAt });
    await queryClient.invalidateQueries({ queryKey: queryKeys.guestAccess.summary });
  });

  return (
    <div className="shell stack">
      <div className="page-heading">
        <h1>View Booking & Waitlist</h1>
        <p className="muted">
          Enter the primary passenger NIC and verify your registered contact to view your booking, payment, ticket, and waitlist status.
        </p>
      </div>

      {!hasVerifiedSession && (
        <Card>
          <h2>Step 1: Primary passenger verification</h2>
          <form className="grid-2" onSubmit={submitRequest}>
            <label className="field">
              Primary NIC
              <input className="input" autoComplete="off" {...requestForm.register('primaryNic')} />
            </label>
            <label className="field">
              Booking reference
              <input className="input" autoComplete="off" {...requestForm.register('bookingReference')} />
            </label>
            <label className="field">
              Registered contact email or phone
              <input className="input" autoComplete="off" {...requestForm.register('contact')} />
            </label>
            <div className="field">
              <span className="muted">NIC is used only as an identifier. It is not exposed in the page.</span>
              <button className="button" disabled={request.isPending}>{request.isPending ? 'Requesting code…' : 'Request verification code'}</button>
            </div>
            {request.error && <div className="form-alert" role="alert">{request.error.message}</div>}
          </form>
        </Card>
      )}

      {!hasVerifiedSession && access.requestId && (
        <Card>
          <h2>Step 2: Enter OTP</h2>
          <form className="grid-2" onSubmit={submitOtp}>
            <label className="field">
              Verification code
              <input className="input" inputMode="numeric" autoComplete="one-time-code" {...otpForm.register('otp')} />
            </label>
            <div className="field">
              <span className="muted">Enter the one-time code sent to the registered contact.</span>
              <button className="button" disabled={verify.isPending}>{verify.isPending ? 'Verifying…' : 'Verify booking access'}</button>
            </div>
            {verify.error && <div className="form-alert" role="alert">{verify.error.message}</div>}
          </form>
        </Card>
      )}

      {hasVerifiedSession && (
        <>
          {activity.isLoading && !activity.data && <LoadingState label="Loading your verified booking details…" />}
          {activity.isError && (activity.error as any)?.status !== 401 && (activity.error as any)?.status !== 403 && <ErrorState message={activity.error.message} retry={() => activity.refetch()} />}
          {activity.data && <VerifiedActivity data={activity.data} onClear={() => { access.clear(); queryClient.removeQueries({ queryKey: queryKeys.guestAccess.summary }); }} />}
          {!activity.data && (activity.isError && ((activity.error as any)?.status === 401 || (activity.error as any)?.status === 403)) && <EmptyState title="Verification required" message="Enter the primary NIC and verify the registered contact to continue." />}
        </>
      )}
    </div>
  );
}

function VerifiedActivity({ data, onClear }: { data: Record<string, any>; onClear: () => void }) {
  const booking = data.bookings?.[0];
  const waitlist = data.waitlistEntries || [];
  return (
    <div className="stack">
      <Card>
        <h2>Verified customer summary</h2>
        <p className="muted">Primary passenger: {data.customer?.primaryPassengerName || '—'} · NIC {data.customer?.maskedNic || 'masked'}</p>
        <div className="grid-3">
          <SummaryCard title="Active bookings" value={String(data.summary?.activeBookings ?? 0)} />
          <SummaryCard title="Pending payments" value={String(data.summary?.pendingPayments ?? 0)} />
          <SummaryCard title="Active waitlists" value={String(data.summary?.activeWaitlistEntries ?? 0)} />
        </div>
        <button className="button button-secondary" onClick={onClear}>End Booking Session</button>
      </Card>

      {booking && <GuestBookingCard booking={booking} />}
      {waitlist.length ? <GuestWaitlistCard entries={waitlist} /> : <EmptyState title="No active waitlist entries" message="No active waitlist entries were found." />}
    </div>
  );
}

export function GuestBookingCard({ booking }: { booking: Record<string, any> }) {
  return (
    <Card>
      <h2>Booking {booking.bookingReference}</h2>
      <p className="muted">{booking.journey?.train?.name || 'Train'} · {booking.journey?.serviceNumber || booking.journey?.journeyNumber || 'Service'}</p>
      <p className="badge">{booking.status}</p>
      <PassengerList passengers={booking.passengers || []} seats={booking.seats || []} />
      <PaymentStatusPanel booking={booking} />
      <TicketStatusPanel booking={booking} />
    </Card>
  );
}

export function PassengerList({ passengers, seats }: { passengers: Record<string, any>[]; seats: Record<string, any>[] }) {
  return (
    <div className="stack">
      {passengers.map((passenger) => {
        const seat = seats.find((item) => item.passengerNumber === passenger.passengerNumber);
        return (
          <div key={passenger.id || passenger.passengerNumber} className="notice">
            <b>{passenger.fullName}</b> {passenger.isPrimaryPassenger ? '(Primary passenger)' : ''}
            <div className="muted">{seat ? `Coach ${seat.coachNumber || '—'} · Seat ${seat.seatNumber || '—'}` : 'Seat pending'}</div>
            {passenger.maskedIdentityNumber && <div className="muted">Identity {passenger.maskedIdentityNumber}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function PaymentStatusPanel({ booking }: { booking: Record<string, any> }) {
  const status = String(booking.paymentStatus || booking.latestPayment?.status || 'AWAITING_PAYMENT');
  return (
    <Card>
      <h3>Payment status</h3>
      <p>{paymentMessage(status)}</p>
      <span className="badge">{status}</span>
    </Card>
  );
}

export function TicketStatusPanel({ booking }: { booking: Record<string, any> }) {
  const available = ['CONFIRMED', 'COMPLETED'].includes(String(booking.status));
  return (
    <Card>
      <h3>Ticket status</h3>
      <p>{available ? 'Ticket Available' : 'Ticket is not available yet.'}</p>
      {available && <div className="journey-actions"><a className="button" href={`/booking/${booking.bookingId}/ticket`}>View Ticket</a></div>}
    </Card>
  );
}

export function GuestWaitlistCard({ entries }: { entries: Record<string, any>[] }) {
  return (
    <div className="stack">
      {entries.map((entry) => (
        <Card key={entry.waitlistEntryId}>
          <h3>Waitlist {entry.waitlistReference}</h3>
          <p className="muted">{entry.journey?.train?.name || 'Journey'} · {entry.status}</p>
          <p>{entry.passengerCount} passenger{entry.passengerCount > 1 ? 's' : ''}</p>
          {entry.offeredSeat && <WaitlistOfferPanel entry={entry} />}
        </Card>
      ))}
    </div>
  );
}

export function WaitlistOfferPanel({ entry }: { entry: Record<string, any> }) {
  return (
    <div className="notice warning">
      <b>A seat offer is available.</b>
      <div className="muted">Offer expiry: {entry.offerExpiry ? new Date(entry.offerExpiry).toLocaleString() : 'Unavailable'}</div>
      <div className="muted">Seats offered: {entry.offeredSeat?.seatNumber || '—'}</div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return <Card><div className="muted">{title}</div><strong>{value}</strong></Card>;
}

function paymentMessage(status: string) {
  switch (status) {
    case 'AWAITING_PAYMENT': return 'Payment has not been submitted.';
    case 'AWAITING_VERIFICATION': return 'Your bank slip is waiting for Admin review.';
    case 'PROCESSING': return 'Your payment is currently being reviewed.';
    case 'PAID': return 'Payment approved. Your booking is confirmed.';
    case 'REJECTED': return 'Payment was rejected. Review the reason and submit a corrected slip when allowed.';
    case 'EXPIRED': return 'Payment verification expired and the reserved seats were released.';
    default: return 'Payment status unavailable.';
  }
}