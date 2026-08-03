import { PermissionPageGuard } from '@/components/auth/PermissionPageGuard';
import { ManagementPlaceholder } from '@/components/management/ManagementPlaceholder';
import { PERMISSIONS as P } from '@/constants/permissions';
export default function Page() {
  return (
    <PermissionPageGuard permission={P.TRAIN_VIEW}>
      <ManagementPlaceholder
        title="Train fleet"
        description="Role-scoped train fleet and journey usage."
      />
    </PermissionPageGuard>
  );
}
