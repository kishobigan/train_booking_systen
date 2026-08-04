'use client';

import { JourneySearchForm } from '@/components/journeys/JourneySearchForm';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatusState';
import { useUpcomingJourneys } from '@/hooks/api/useUpcomingJourneys';
import { UpcomingJourneyList } from './UpcomingJourneyCards';

export function PublicFindTrainsPageView() {
  const upcoming = useUpcomingJourneys({ page: 1, limit: 6 });
  return (
    <div className="shell stack">
      <div className="page-heading">
        <h1>Find Your Train</h1>
        <p className="muted">Available journeys from today appear immediately. Refine by route, date, passenger count, or coach class.</p>
      </div>
      <Card>
        <JourneySearchForm variant="full" defaults={{ date: new Date().toISOString().slice(0, 10) }} />
      </Card>
      <section className="stack">
        <div className="page-heading">
          <h2>Available Journeys From Today</h2>
          <p className="muted">Choose any bookable journey and continue to seat selection.</p>
        </div>
        {upcoming.isLoading && <LoadingState label="Loading today’s bookable journeys…" />}
        {upcoming.isError && <ErrorState message={upcoming.error.message} retry={() => upcoming.refetch()} />}
        {upcoming.data?.items?.length ? (
          <UpcomingJourneyList journeys={upcoming.data.items} passengerCount={1} />
        ) : (
          upcoming.data && (
            <EmptyState title="No bookable journeys are currently available from today." message="Try changing the route or travel date." />
          )
        )}
      </section>
    </div>
  );
}