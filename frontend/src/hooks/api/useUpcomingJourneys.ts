'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { journeyService } from '@/services/journey.service';

export function useUpcomingJourneys(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.journeys.upcoming(params),
    queryFn: ({ signal }) => journeyService.getUpcomingJourneys(params, signal),
    enabled,
  });
}