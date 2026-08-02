'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSeatMapSocket } from '@/services/socket.client';
import { fetchSeatMap } from '@/services/seatmap.api';
const stateEvents = ['seat:held','seats:held','seat:confirmed','seats:confirmed','seat:released','seats:released','seat:expired','seat:blocked','seat:unblocked','seat:maintenance','seat:waitlist-offered','coach:enabled','coach:disabled','journey:booking-closed','journey:cancelled'];
export function useSeatMapSocket(input: { journeyId: string; originJourneyStationId: string; destinationJourneyStationId: string; token?: string }) {
  const [connected, setConnected] = useState(false); const [seatMap, setSeatMap] = useState<any>(null); const [error, setError] = useState<string | null>(null); const version = useRef(0);
  const resync = useCallback(async () => { try { const snapshot = await fetchSeatMap(input.journeyId, input.originJourneyStationId, input.destinationJourneyStationId); version.current = Number(snapshot.version); setSeatMap(snapshot); setError(null); } catch { setError('Seat map could not be synchronized.'); } }, [input.journeyId, input.originJourneyStationId, input.destinationJourneyStationId]);
  useEffect(() => { const socket = createSeatMapSocket(input.token); const payload = { journeyId: input.journeyId, originJourneyStationId: input.originJourneyStationId, destinationJourneyStationId: input.destinationJourneyStationId };
    const snapshot = (value: any) => { version.current = Number(value.version); setSeatMap(value); };
    const changed = (event: any) => { if (Number(event.version) <= version.current) return; version.current = Number(event.version); socket.emit('seatmap:resync', { ...payload, lastKnownVersion: String(version.current) }); };
    socket.on('connect', () => { setConnected(true); socket.emit('seatmap:subscribe', payload); }); socket.on('disconnect', () => setConnected(false)); socket.on('seatmap:snapshot', snapshot); socket.on('seatmap:error', (value) => setError(value.error?.message || 'Real-time seat map error')); stateEvents.forEach((name) => socket.on(name, changed));
    return () => { socket.emit('seatmap:unsubscribe', {}); stateEvents.forEach((name) => socket.off(name, changed)); socket.off('seatmap:snapshot', snapshot); socket.disconnect(); };
  }, [input.journeyId, input.originJourneyStationId, input.destinationJourneyStationId, input.token]);
  return { connected, seatMap, error, resync };
}
