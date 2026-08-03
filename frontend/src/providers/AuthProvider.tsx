'use client';
import { PropsWithChildren, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/modules/auth.service';
import { ApiError } from '@/services/http/api-error';
import { socketManager } from '@/services/websocket/socket-manager';
import { authTokenStore } from '@/services/http/auth-token-store';
import { AUTH_STATUS, useAuthStore } from '@/store/auth.store';

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const initialize = useCallback(async () => {
    const state = useAuthStore.getState();
    if (state.status === AUTH_STATUS.AUTHENTICATED && authTokenStore.getAccessToken()) return;
    if (state.initialized && state.status === AUTH_STATUS.UNAUTHENTICATED) return;
    state.setLoading();
    try {
      const accessToken = await authService.refresh();
      const user = await authService.me();
      useAuthStore.getState().setAuthenticated({ accessToken, user });
      socketManager.reconnectAuthenticated();
    } catch (error) {
      socketManager.disconnect();
      if (error instanceof ApiError && (error.status === 0 || error.retryable))
        useAuthStore.getState().setBootstrapError(error.message);
      else useAuthStore.getState().setUnauthenticated();
    }
  }, []);
  useEffect(() => {
    void initialize();
    const expired = () => {
      socketManager.disconnect();
      queryClient.clear();
      useAuthStore.getState().setUnauthenticated();
    };
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [initialize, queryClient]);
  return children;
}
