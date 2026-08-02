'use client';
import { create } from 'zustand';
import { User } from '@/types/domain';
import { authTokenStore } from '@/services/http/auth-token-store';

interface AuthState { user: User | null; initialized: boolean; setSession: (user: User, token?: string) => void; clear: () => void; setInitialized: (value: boolean) => void }
export const useAuthStore = create<AuthState>((set) => ({
  user: null, initialized: false,
  setSession: (user, token) => { if (token) authTokenStore.setAccessToken(token); set({ user, initialized: true }); },
  clear: () => { authTokenStore.clear(); set({ user: null, initialized: true }); },
  setInitialized: (initialized) => set({ initialized }),
}));
