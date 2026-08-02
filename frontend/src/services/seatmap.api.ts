import { apiClient } from './http/api-client';
import { unwrap } from './http/api-response';
import { SeatMapSnapshot } from '@/types/domain';
export async function fetchSeatMap(journeyId: string, originJourneyStationId: string, destinationJourneyStationId: string) { return unwrap<SeatMapSnapshot>((await apiClient.get(`/journeys/${journeyId}/seat-map`, { params: { originJourneyStationId, destinationJourneyStationId } })).data); }
