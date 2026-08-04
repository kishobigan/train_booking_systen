import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export default function StaffLoginPage() {
  return (
    <div className="shell center">
      <Card>
        <div className="page-heading">
          <h1>Staff Login</h1>
          <p className="muted">Railway Management Login for SUPER_ADMIN, ADMIN, and STAFF.</p>
        </div>
        <Link className="button" href="/login">Continue to staff sign-in</Link>
      </Card>
    </div>
  );
}