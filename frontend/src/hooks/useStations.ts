'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { stationService } from '@/services/modules/domain.services';
export function useStations(search = '') { return useQuery({ queryKey: queryKeys.stations.search(search), queryFn: () => stationService.list(search ? { search } : undefined) }); }
