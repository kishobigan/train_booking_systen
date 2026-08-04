'use client';

import Link from 'next/link';
import { ArrowRight, Clock3, MapPin, TrainFront } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export function UpcomingJourneyList({
  journeys,
  passengerCount = 1,
  coachClass,
}: {
  journeys: Record<string, any>[];
  passengerCount?: number;
  coachClass?: string;
}) {
  if (!journeys.length) return null;
  return (
    <div className="stack">
      {journeys.map((journey) => (
        <UpcomingJourneyCard
          key={journey.journeyId}
          journey={journey}
          passengerCount={passengerCount}
          coachClass={coachClass}
        />
      ))}
    </div>
  );
}

export function UpcomingJourneyCard({
  journey,
  passengerCount = 1,
  coachClass,
}: {
  journey: Record<string, any>;
  passengerCount?: number;
  coachClass?: string;
}) {
  const query = new URLSearchParams({
    originJourneyStationId: journey.origin?.journeyStationId,
    destinationJourneyStationId: journey.destination?.journeyStationId,
    passengerCount: String(passengerCount || 1),
  });
  if (coachClass) query.set('coachClass', coachClass);
  return (
    <Card className="journey-card">
      <div className="journey-card__head">
        <span className={`badge status-${String(journey.status || 'scheduled').toLowerCase()}`}>
          {journey.status || 'SCHEDULED'}
        </span>
        <h2>{journey.train?.name || 'Rail service'}</h2>
        <p className="muted">
          Train {journey.train?.trainNumber || '—'} · Service {journey.serviceNumber || '—'}
        </p>
      </div>
      <div className="journey-card__route">
        <div>
          <small>From</small>
          <b>{journey.origin?.name || 'Origin'}</b>
          <span>{formatTime(journey.origin?.scheduledDepartureAt)}</span>
        </div>
        <div className="duration">
          <Clock3 size={16} />
          {journey.durationMinutes ? `${journey.durationMinutes} min` : 'Route' }
        </div>
        <div>
          <small>To</small>
          <b>{journey.destination?.name || 'Destination'}</b>
          <span>{formatTime(journey.destination?.scheduledArrivalAt)}</span>
        </div>
      </div>
      <div className="journey-card__meta">
        <span><TrainFront size={16} /> {journey.availableSeatCount || 0} seats available</span>
        <span><MapPin size={16} /> {journey.route?.name || 'Public route'}</span>
        <span>{journey.currency || 'LKR'} {journey.minimumFare ?? '—'}</span>
        <Link className="button" href={`/journey/${journey.journeyId}/seats?${query}`}>
          Choose Journey <ArrowRight size={17} />
        </Link>
      </div>
    </Card>
  );
}

const formatTime = (value?: string) =>
  value ? new Intl.DateTimeFormat('en-LK', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Schedule unavailable';