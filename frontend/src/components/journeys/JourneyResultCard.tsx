import Link from 'next/link';
import { ArrowRight, Clock3, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
export function JourneyResultCard({
  journey,
  search,
}: {
  journey: Record<string, any>;
  search: URLSearchParams;
}) {
  const query = new URLSearchParams({
    originJourneyStationId: journey.origin.journeyStationId,
    destinationJourneyStationId: journey.destination.journeyStationId,
    passengerCount: search.get('passengerCount') || '1',
  });
  if (search.get('coachClass')) query.set('coachClass', search.get('coachClass')!);
  return (
    <Card className="journey-card">
      <div>
        <span className={`badge status-${String(journey.status).toLowerCase()}`}>
          {journey.status}
        </span>
        <h2>{journey.train?.name || 'Rail service'}</h2>
        <p className="muted">
          Train {journey.train?.trainNumber || journey.serviceNumber} · Service{' '}
          {journey.serviceNumber} · {journey.route?.name}
        </p>
      </div>
      <div className="timeline">
        <div>
          <b>{formatTime(journey.origin.scheduledDepartureAt)}</b>
          <span>{journey.origin.name}</span>
        </div>
        <div className="duration">
          <Clock3 size={16} />
          {journey.durationMinutes} min
        </div>
        <div>
          <b>{formatTime(journey.destination.scheduledArrivalAt)}</b>
          <span>{journey.destination.name}</span>
        </div>
      </div>
      <div className="journey-actions">
        <span>
          <Users size={17} /> {journey.availableSeatCount} seats currently available
        </span>
        {journey.minimumFare != null && <strong>From LKR {journey.minimumFare}</strong>}
        <Link className="button" href={`/journey/${journey.journeyId}/seats?${query}`}>
          Select train <ArrowRight size={17} />
        </Link>
      </div>
    </Card>
  );
}
const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en-LK', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
