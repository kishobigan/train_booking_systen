'use client';
import { useCallback, useEffect, useState } from 'react';
export function useBookingHoldTimer(expiresAt?: string) {
  const calculate = useCallback(
    () => Math.max(0, Math.floor((new Date(expiresAt || 0).getTime() - Date.now()) / 1000)),
    [expiresAt],
  );
  const [seconds, setSeconds] = useState(calculate);
  useEffect(() => {
    const id = setInterval(() => setSeconds(calculate()), 1000);
    return () => clearInterval(id);
  }, [calculate]);
  return {
    seconds,
    expired: seconds === 0,
    label: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
  };
}
