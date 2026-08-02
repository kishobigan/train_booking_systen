'use client';
import { PropsWithChildren, useEffect } from 'react';
import { authService } from '@/services/modules/auth.service';
import { useAuthStore } from '@/store/auth.store';
export function AuthProvider({ children }: PropsWithChildren) {
  const { setSession, clear, setInitialized } = useAuthStore();
  useEffect(() => {
    authService.me().then((user) => setSession(user)).catch(() => setInitialized(true));
    const expired = () => clear(); window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [clear, setInitialized, setSession]);
  return children;
}
