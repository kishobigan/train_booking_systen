import Link from 'next/link';
import { TrainFront } from 'lucide-react';
import { AuthProvider } from '@/providers/AuthProvider';
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <main id="main-content" className="app-main auth-main" tabIndex={-1}>
        <div className="auth-brand">
          <Link className="brand" href="/">
            <TrainFront /> Railway Operations
          </Link>
        </div>
        {children}
      </main>
    </AuthProvider>
  );
}
