import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Train Booking System',
  description: 'Book train tickets easily',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
