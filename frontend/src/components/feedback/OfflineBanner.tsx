'use client';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
export function OfflineBanner() { const online = useNetworkStatus(); return online ? null : <div className="offline-banner" role="status"><WifiOff size={16} /> You are offline. Changes may not be saved.</div>; }
