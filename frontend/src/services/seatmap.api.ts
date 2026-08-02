export async function fetchSeatMap(journeyId: string, originJourneyStationId: string, destinationJourneyStationId: string) {
  const query = new URLSearchParams({ originJourneyStationId, destinationJourneyStationId });
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4050/api/v1'}/journeys/${journeyId}/seat-map?${query}`);
  if (!response.ok) throw new Error('Unable to load seat map');
  return (await response.json()).data;
}
