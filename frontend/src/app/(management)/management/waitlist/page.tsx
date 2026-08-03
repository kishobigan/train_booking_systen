import { PermissionPageGuard } from '@/components/auth/PermissionPageGuard';
import { ManagementPlaceholder } from '@/components/management/ManagementPlaceholder';
import { PERMISSIONS as P } from '@/constants/permissions';
export default function Page() {
  return (
    <PermissionPageGuard permission={P.WAITLIST_VIEW}>
      <ManagementPlaceholder
        title="Waitlist operations"
        description="Waitlists restricted to the current management scope."
      />
    </PermissionPageGuard>
  );
}
