'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrainFront, UserRound } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
export function AppHeader() {
  const path = usePathname();
  const user = useAuthStore((s) => s.user);
  if (path.startsWith('/management')) return null;
  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link className="brand" href="/">
          <TrainFront aria-hidden /> Railway Booking
        </Link>
        <nav aria-label="Primary">
          <Link href="/journeys">Find trains</Link>
          <Link href="/bookings">My bookings</Link>
          <Link href="/waitlist">Waitlist</Link>
          {user ? (
            <span className="user-label">
              <UserRound size={17} />
              {user.fullName}
            </span>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
