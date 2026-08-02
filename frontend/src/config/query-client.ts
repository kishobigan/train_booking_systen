import { QueryClient } from '@tanstack/react-query'; import { queryRetryPolicy, retryDelay } from '@/services/http/retry-policy';
export function createQueryClient() { return new QueryClient({ defaultOptions: { queries: { staleTime: 30000, gcTime: 300000, retry: queryRetryPolicy, retryDelay, refetchOnWindowFocus: false, refetchOnReconnect: true }, mutations: { retry: false } } }); }
