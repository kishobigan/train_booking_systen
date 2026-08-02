import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { authTokenStore } from './auth-token-store';
import { normalizeApiError } from './api-error';

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };
export const apiClient = axios.create({ baseURL: env.apiBaseUrl, timeout: 15_000, withCredentials: true });
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.request.use((config) => {
  const token = authTokenStore.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Request-ID'] = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return config;
});

apiClient.interceptors.response.use((response) => response, async (error: AxiosError) => {
  const original = error.config as RetryConfig | undefined;
  const excluded = ['/auth/login', '/auth/refresh', '/auth/logout'].some((path) => original?.url?.includes(path));
  if (error.response?.status === 401 && original && !original._retried && !excluded) {
    original._retried = true;
    try {
      refreshPromise ??= axios.post(`${env.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
        .then((response) => {
          const token = response.data.data.accessToken as string;
          authTokenStore.setAccessToken(token);
          return token;
        }).finally(() => { refreshPromise = null; });
      original.headers.Authorization = `Bearer ${await refreshPromise}`;
      return apiClient(original);
    } catch {
      authTokenStore.clear();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
    }
  }
  throw normalizeApiError(error);
});
