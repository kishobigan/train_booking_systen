'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { journeyService } from '@/services/modules/domain.services';
export function useJourneySearch(params: Record<string, unknown>) { return useQuery({ queryKey: queryKeys.journeys.search(params), queryFn: () => journeyService.search(params), enabled: Boolean(params.originStationId && params.destinationStationId && params.date) }); }
