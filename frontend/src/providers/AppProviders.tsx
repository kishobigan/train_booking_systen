'use client';
import { PropsWithChildren } from 'react';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
export function AppProviders({ children }: PropsWithChildren) { return <QueryProvider><AuthProvider><OfflineBanner />{children}</AuthProvider></QueryProvider>; }
