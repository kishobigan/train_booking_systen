import { Suspense } from 'react';
import { Card } from '@/components/ui/Card';
import { LoginForm } from '@/components/auth/LoginForm';
export default function LoginPage() {
  return (
    <div className="shell">
      <Card className="auth-card">
        <div className="page-heading">
          <h1>System Staff Login</h1>
          <p className="muted">
            For Super Admin, Admin, and Staff accounts only. Passengers can book without signing in.
          </p>
        </div>
        <Suspense fallback={<p>Preparing secure login…</p>}>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
