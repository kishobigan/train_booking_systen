'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { fetchSeatMap } from '@/services/seatmap.api';
import { SEAT_MAP_EVENTS, SeatMapSubscription } from '@/services/websocket/socket-events';
import { socketManager } from '@/services/websocket/socket-manager';
import { SeatMapSnapshot } from '@/types/domain';

export function useSeatMap(input: SeatMapSubscription) {
  const queryClient = useQueryClient(); const [connected, setConnected] = useState(false); const [socketError, setSocketError] = useState<string | null>(null);
  const subscription = useMemo(() => ({ journeyId: input.journeyId, originJourneyStationId: input.originJourneyStationId, destinationJourneyStationId: input.destinationJourneyStationId }), [input.destinationJourneyStationId, input.journeyId, input.originJourneyStationId]);
  const key = useMemo(() => queryKeys.seatMap.snapshot(subscription), [subscription]);
  const query = useQuery({ queryKey: key, queryFn: () => fetchSeatMap(input.journeyId, input.originJourneyStationId, input.destinationJourneyStationId), enabled: Boolean(input.journeyId && input.originJourneyStationId && input.destinationJourneyStationId) });
  useEffect(() => {
    if (!subscription.journeyId) return; const socket = socketManager.connect();
    const connect = () => { setConnected(true); setSocketError(null); socket.emit('seatmap:subscribe', subscription); };
    const disconnect = () => setConnected(false);
    const snapshot = (value: SeatMapSnapshot) => queryClient.setQueryData(key, value);
    const changed = () => queryClient.invalidateQueries({ queryKey: key });
    const failed = (value: { error?: { message?: string } }) => setSocketError(value.error?.message ?? 'Real-time updates are temporarily unavailable.');
    socket.on('connect', connect).on('disconnect', disconnect).on('seatmap:snapshot', snapshot).on('seatmap:error', failed);
    SEAT_MAP_EVENTS.forEach((event) => socket.on(event, changed)); if (socket.connected) connect();
    return () => { socket.emit('seatmap:unsubscribe', subscription); socket.off('connect', connect).off('disconnect', disconnect).off('seatmap:snapshot', snapshot).off('seatmap:error', failed); SEAT_MAP_EVENTS.forEach((event) => socket.off(event, changed)); };
  }, [key, queryClient, subscription]);
  return { ...query, seatMap: query.data, connected, socketError };
}
