'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { journeySearchSchema } from '@/schemas/journey-search.schema';
import { useJourneySearch } from '@/hooks/api/useJourneySearch';
import { JourneyResultCard } from './JourneyResultCard';
import { ErrorState, EmptyState, LoadingState } from '@/components/ui/StatusState';
export function JourneyResultsView() {
  const url = useSearchParams();
  const parsed = journeySearchSchema.safeParse(Object.fromEntries(url));
  const sortBy = url.get('sortBy') || 'departure';
  const params = parsed.success
    ? { ...parsed.data, page: Number(url.get('page') || 1), limit: 20 }
    : {};
  const query = useJourneySearch(params, parsed.success);
  if (!parsed.success) return <Invalid />;
  const sort = (items: Record<string, any>[]) =>
    [...items].sort((a, b) =>
      sortBy === 'duration'
        ? a.durationMinutes - b.durationMinutes
        : sortBy === 'availability'
          ? b.availableSeatCount - a.availableSeatCount
          : new Date(a.origin.scheduledDepartureAt).getTime() -
            new Date(b.origin.scheduledDepartureAt).getTime(),
    );
  return (
    <div className="shell stack">
      <div className="results-heading">
        <div>
          <h1>
            {query.data?.items[0]?.origin.name || 'Origin'} →{' '}
            {query.data?.items[0]?.destination.name || 'Destination'}
          </h1>
          <p className="muted">
            {parsed.data.date} · {parsed.data.passengerCount} passenger(s)
          </p>
        </div>
        <Link className="button button-secondary" href="/journeys">
          Modify search
        </Link>
      </div>
      <label className="sort">
        Sort by{' '}
        <select
          className="input"
          value={sortBy}
          onChange={(e) => {
            const q = new URLSearchParams(url);
            q.set('sortBy', e.target.value);
            history.replaceState(null, '', `?${q}`);
            location.reload();
          }}
        >
          <option value="departure">Departure time</option>
          <option value="duration">Duration</option>
          <option value="availability">Available seats</option>
        </select>
      </label>
      {query.data && query.data.pagination.totalItems > 0 && (
        <p className="muted" aria-live="polite">
          {query.data.pagination.totalItems} matching train
          {query.data.pagination.totalItems === 1 ? '' : 's'} available. Select a train to continue
          to seat selection.
        </p>
      )}
      {query.isLoading && <LoadingState label="Finding available journeys…" />}
      {query.isError && (
        <ErrorState message={query.error.message} retry={() => query.refetch()} />
      )}{' '}
      {query.data?.items.length === 0 && (
        <EmptyState title="No journeys found" message="Try another date or modify your route." />
      )}
      {query.data &&
        sort(query.data.items).map((item) => (
          <JourneyResultCard key={item.journeyId} journey={item} search={url} />
        ))}
      {query.data && query.data.pagination.totalPages > 1 && (
        <nav className="journey-actions" aria-label="Journey result pages">
          {query.data.pagination.hasPreviousPage && (
            <Link
              className="button button-secondary"
              href={pageHref(url, query.data.pagination.page - 1)}
            >
              Previous trains
            </Link>
          )}
          <span>
            Page {query.data.pagination.page} of {query.data.pagination.totalPages}
          </span>
          {query.data.pagination.hasNextPage && (
            <Link
              className="button button-secondary"
              href={pageHref(url, query.data.pagination.page + 1)}
            >
              More trains
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
function pageHref(search: URLSearchParams, page: number) {
  const query = new URLSearchParams(search);
  query.set('page', String(page));
  return `/journeys/results?${query}`;
}
function Invalid() {
  return (
    <div className="shell">
      <EmptyState
        title="Your search is incomplete"
        message="Choose valid stations, a travel date, and passenger count."
      />
      <div className="center">
        <Link className="button" href="/journeys">
          Start a new search
        </Link>
      </div>
    </div>
  );
}
