'use client';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useJourneyDetails } from '@/hooks/api/useJourneyDetails';
import { useSeatMap } from '@/hooks/useSeatMap';
import { useSeatSelectionStore } from '@/store/seat-selection.store';
import { useBookingDraftStore } from '@/store/booking-draft.store';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import CoachMap from './CoachMap';
import SeatLegend from './SeatLegend';
import SeatMapSummary from './SeatMapSummary';
import SeatMapConnectionStatus from './SeatMapConnectionStatus';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/StatusState';
export function SeatSelectionView({
  journeyId,
  originJourneyStationId,
  destinationJourneyStationId,
  passengerCount,
  coachClass,
}: {
  journeyId: string;
  originJourneyStationId: string;
  destinationJourneyStationId: string;
  passengerCount: number;
  coachClass?: string;
}) {
  const router = useRouter(),
    online = useNetworkStatus();
  const journey = useJourneyDetails(journeyId);
  const input = useMemo(
    () => ({ journeyId, originJourneyStationId, destinationJourneyStationId }),
    [destinationJourneyStationId, journeyId, originJourneyStationId],
  );
  const map = useSeatMap(input);
  const { seatIds, toggle, reset } = useSeatSelectionStore();
  const setRoute = useBookingDraftStore((s) => s.setRoute);
  useEffect(
    () => reset(journeyId),
    [journeyId, originJourneyStationId, destinationJourneyStationId, reset],
  );
  useEffect(() => {
    if (!map.seatMap) return;
    const available = new Set(
      (map.seatMap.coaches || []).flatMap((c: any) =>
        c.seats.filter((s: any) => s.status === 'AVAILABLE').map((s: any) => s.journeySeatId),
      ),
    );
    for (const id of seatIds) if (!available.has(id)) toggle(id, passengerCount);
  }, [map.seatMap, passengerCount, seatIds, toggle]);
  if (journey.isLoading || map.isLoading)
    return <LoadingState label="Loading the live seat map…" />;
  if (journey.isError || map.isError)
    return (
      <ErrorState
        message={(journey.error || map.error)?.message || 'Seat map unavailable.'}
        retry={() => {
          journey.refetch();
          map.refetch();
        }}
      />
    );
  const coaches = (map.seatMap?.coaches || []).filter(
    (c: any) => !coachClass || c.coachClass === coachClass,
  );
  const proceed = () => {
    setRoute({
      journeyId,
      originJourneyStationId,
      destinationJourneyStationId,
      passengerCount,
      coachClass,
      selectedSeatIds: seatIds,
    });
    router.push('/booking');
  };
  return (
    <div className="shell stack">
      <div className="page-heading">
        <h1>
          Choose {passengerCount} seat{passengerCount > 1 ? 's' : ''}
        </h1>
        <p className="muted">
          {journey.data?.train?.name} · Service {journey.data?.serviceNumber}
        </p>
      </div>
      <div className="seat-layout">
        <Card className="seat-map-scroll">
          <SeatMapConnectionStatus connected={map.connected} />
          {map.socketError && (
            <div className="notice warning">
              {map.socketError} Availability will be checked again when you book.
            </div>
          )}
          <SeatLegend />
          <SeatMapSummary summary={map.seatMap?.summary} />
          {coaches.map((coach: any) => (
            <CoachMap
              key={coach.journeyCoachId}
              coach={coach}
              selectedSeatIds={seatIds}
              onSelect={(id: string) => toggle(id, passengerCount)}
            />
          ))}
        </Card>
        <Card className="selection-panel">
          <h2>Selected seats</h2>
          <p>
            {seatIds.length} of {passengerCount} selected
          </p>
          <div className="seat-chips">
            {seatIds.map((id) => (
              <span key={id} className="badge">
                {findSeat(map.seatMap, id)?.seatNumber || id.slice(0, 6)}
              </span>
            ))}
          </div>
          <button
            className="button"
            disabled={!online || !map.connected || seatIds.length !== passengerCount}
            onClick={proceed}
          >
            Continue to passenger details
          </button>
          {!map.connected && <small>Reconnect to live updates before continuing.</small>}
        </Card>
      </div>
    </div>
  );
}
function findSeat(map: any, id: string) {
  return map?.coaches?.flatMap((c: any) => c.seats).find((s: any) => s.journeySeatId === id);
}
