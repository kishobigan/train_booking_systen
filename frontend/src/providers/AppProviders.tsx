'use client';
import { PropsWithChildren } from 'react';
import { QueryProvider } from './QueryProvider';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <OfflineBanner />
      {children}
    </QueryProvider>
  );
}
