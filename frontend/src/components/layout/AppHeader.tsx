'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, TrainFront, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
export function AppHeader() {
  const path = usePathname();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [path]);
  if (path.startsWith('/management')) return null;
  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link className="brand" href="/">
          <TrainFront aria-hidden /> Railway Booking
        </Link>
        <button
          className="public-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
        <nav id="primary-navigation" className={menuOpen ? 'open' : ''} aria-label="Primary">
          <Link className={path.startsWith('/find-trains') || path.startsWith('/journeys') ? 'active' : ''} href="/find-trains">Find Trains</Link>
          <Link className={path.startsWith('/booking-access') ? 'active' : ''} href="/booking-access">Booking & Waitlist</Link>
          {user ? (
            <Link className="user-label" href="/management/dashboard">
              <UserRound size={17} />
              {user.fullName}
            </Link>
          ) : (
            <Link className={path.startsWith('/staff-login') || path.startsWith('/login') ? 'active staff-login-link' : 'staff-login-link'} href="/staff-login">Staff Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
