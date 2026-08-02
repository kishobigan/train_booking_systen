'use client';
import { usePathname } from 'next/navigation';
export function AppFooter() {
  const path = usePathname();
  if (path.startsWith('/management')) return null;
  return (
    <footer className="app-footer">
      <div className="shell">Sri Lanka Railway Booking · Secure, accessible journey planning</div>
    </footer>
  );
}
