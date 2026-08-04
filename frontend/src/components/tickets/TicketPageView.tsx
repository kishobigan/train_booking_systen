'use client';
import Link from 'next/link';
import { Printer, TicketCheck } from 'lucide-react';
import { useTicket } from '@/hooks/api/useTicket';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/StatusState';
export function TicketPageView({ bookingId }: { bookingId: string }) {
  const query = useTicket(bookingId);
  if (query.isLoading) return <LoadingState label="Preparing your ticket…" />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  const t = query.data!;
  if (!['CONFIRMED', 'COMPLETED'].includes(t.status))
    return (
      <div className="shell center">
        <LoadingState label="Confirmation is still processing…" />
        <button className="button button-secondary" onClick={() => query.refetch()}>
          Check again
        </button>
      </div>
    );
  return (
    <div className="shell ticket-page">
      <Card className="ticket-card">
        <header>
          <TicketCheck />
          <div>
            <span className="eyebrow">Confirmed railway ticket</span>
            <h1>{t.bookingReference}</h1>
          </div>
          <span className="badge status-confirmed">{t.status}</span>
        </header>
        <div className="ticket-route">
          <div>
            <small>From</small>
            <b>{t.originJourneyStation?.station?.name || t.origin?.name}</b>
            <span>{format(t.originJourneyStation?.scheduledDepartureAt || t.departureAt)}</span>
          </div>
          <div>→</div>
          <div>
            <small>To</small>
            <b>{t.destinationJourneyStation?.station?.name || t.destination?.name}</b>
            <span>{format(t.destinationJourneyStation?.scheduledArrivalAt || t.arrivalAt)}</span>
          </div>
        </div>
        <section>
          <h2>Passengers and seats</h2>
          {(t.passengers || []).map((p: any) => (
            <div className="ticket-passenger" key={p.id || p.fullName}>
              <b>{p.fullName}</b>
              <span>
                Coach {p.coachNumber || p.bookingSeat?.coachNumber || '—'} · Seat{' '}
                {p.seatNumber || p.bookingSeat?.seatNumber || '—'}
              </span>
            </div>
          ))}
        </section>
        {t.qrCodePayload && (
          // Backend supplies the signed QR image directly; it is not a normal optimizable asset.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="ticket-qr"
            src={t.qrCodePayload}
            alt="Signed ticket verification QR code"
          />
        )}
        <div className="notice">
          Carry valid identification and arrive before the stated departure time.
        </div>
      </Card>
      <div className="ticket-actions">
        <button className="button" onClick={() => window.print()}>
          <Printer size={18} /> Print ticket
        </button>
        <Link className="button button-secondary" href="/booking-access">
          Return to bookings
        </Link>
      </div>
    </div>
  );
}
const format = (value?: string) =>
  value ? new Date(value).toLocaleString('en-LK') : 'Schedule unavailable';
