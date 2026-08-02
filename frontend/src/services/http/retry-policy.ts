import { ApiError } from './api-error';
export function queryRetryPolicy(failureCount: number, error: Error) { return failureCount < 2 && error instanceof ApiError && error.retryable; }
export const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 10000);
