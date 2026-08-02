import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';

export const metadata: Metadata = {
  title: { default: 'Railway Booking', template: '%s | Railway Booking' },
  description: 'Plan and book Sri Lankan railway journeys.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body><AppProviders><AppHeader /><main className="app-main">{children}</main><AppFooter /></AppProviders></body>
    </html>
  );
}
