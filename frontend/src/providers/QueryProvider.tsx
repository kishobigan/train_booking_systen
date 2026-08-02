'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useState } from 'react';
import { createQueryClient } from '@/config/query-client';
export function QueryProvider({ children }: PropsWithChildren) { const [client] = useState(createQueryClient); return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
