import { apiClient } from './http/api-client';
import { unwrap } from './http/api-response';
export const journeyService = {
  searchJourneys: async (params: Record<string, unknown>, signal?: AbortSignal) => {
    const response = await apiClient.get('/journeys/search', { params, signal });
    return {
      ...unwrap<{ search: unknown; items: Record<string, any>[] }>(response.data),
      pagination: response.data.pagination as {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      },
    };
  },
  getUpcomingJourneys: async (params: Record<string, unknown> = {}, signal?: AbortSignal) => {
    const response = await apiClient.get('/journeys/upcoming', { params, signal });
    return {
      ...unwrap<{ search: unknown; items: Record<string, any>[] }>(response.data),
      pagination: response.data.pagination as {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      },
    };
  },
  getJourneyDetails: async (id: string) =>
    unwrap<Record<string, any>>((await apiClient.get(`/journeys/${id}`)).data),
};
