'use client';
import { create } from 'zustand';
import { User } from '@/types/domain';
import { authTokenStore } from '@/services/http/auth-token-store';

export const AUTH_STATUS = Object.freeze({
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  AUTHENTICATED: 'AUTHENTICATED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
} as const);
export type AuthStatus = (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS];

interface AuthState {
  status: AuthStatus;
  user: User | null;
  initialized: boolean;
  restrictedPasswordChangeToken: string | null;
  bootstrapError: string | null;
  setLoading: () => void;
  setAuthenticated: (input: { user: User; accessToken: string }) => void;
  setUnauthenticated: () => void;
  setPasswordChangeRequired: (input: { user: User; token: string }) => void;
  setSession: (user: User, token?: string) => void;
  clear: () => void;
  setInitialized: (value: boolean) => void;
  setBootstrapError: (message: string) => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  status: AUTH_STATUS.IDLE,
  user: null,
  initialized: false,
  restrictedPasswordChangeToken: null,
  bootstrapError: null,
  setLoading: () => set({ status: AUTH_STATUS.LOADING, initialized: false, bootstrapError: null }),
  setAuthenticated: ({ user, accessToken }) => {
    authTokenStore.setAccessToken(accessToken);
    set({
      status: AUTH_STATUS.AUTHENTICATED,
      user,
      initialized: true,
      restrictedPasswordChangeToken: null,
      bootstrapError: null,
    });
  },
  setUnauthenticated: () => {
    authTokenStore.clear();
    set({
      status: AUTH_STATUS.UNAUTHENTICATED,
      user: null,
      initialized: true,
      restrictedPasswordChangeToken: null,
      bootstrapError: null,
    });
  },
  setPasswordChangeRequired: ({ user, token }) => {
    authTokenStore.clear();
    set({
      status: AUTH_STATUS.PASSWORD_CHANGE_REQUIRED,
      user,
      initialized: true,
      restrictedPasswordChangeToken: token,
      bootstrapError: null,
    });
  },
  setSession: (user, token) => {
    if (token) authTokenStore.setAccessToken(token);
    set({ status: AUTH_STATUS.AUTHENTICATED, user, initialized: true, bootstrapError: null });
  },
  clear: () => {
    authTokenStore.clear();
    set({
      status: AUTH_STATUS.UNAUTHENTICATED,
      user: null,
      initialized: true,
      restrictedPasswordChangeToken: null,
      bootstrapError: null,
    });
  },
  setInitialized: (initialized) => set({ initialized }),
  setBootstrapError: (bootstrapError) =>
    set({ status: AUTH_STATUS.LOADING, initialized: true, bootstrapError }),
}));
