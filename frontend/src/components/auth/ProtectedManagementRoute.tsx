'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTH_STATUS, useAuthStore } from '@/store/auth.store';
import { AuthenticationLoadingScreen } from './AuthenticationLoadingScreen';
export function ProtectedManagementRoute({ children }: { children: React.ReactNode }) {
  const { status, initialized, bootstrapError } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!initialized) return;
    if (status === AUTH_STATUS.UNAUTHENTICATED)
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    if (status === AUTH_STATUS.PASSWORD_CHANGE_REQUIRED) router.replace('/change-password');
  }, [initialized, pathname, router, status]);
  if (!initialized || status === AUTH_STATUS.LOADING)
    return (
      <AuthenticationLoadingScreen
        message={bootstrapError || undefined}
        retry={bootstrapError ? () => location.reload() : undefined}
      />
    );
  if (status !== AUTH_STATUS.AUTHENTICATED)
    return <AuthenticationLoadingScreen message="Redirecting to staff login…" />;
  return children;
}
