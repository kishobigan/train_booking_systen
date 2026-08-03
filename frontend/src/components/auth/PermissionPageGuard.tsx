'use client';
import Link from 'next/link';
import { ReactNode } from 'react';
import { Permission } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/auth.store';
import { LoadingState } from '@/components/ui/StatusState';
export function PermissionPageGuard({
  permission,
  anyOf,
  allOf,
  scopeAllowed = true,
  fallback,
  children,
}: {
  permission?: Permission;
  anyOf?: Permission[];
  allOf?: Permission[];
  scopeAllowed?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const initialized = useAuthStore((s) => s.initialized),
    user = useAuthStore((s) => s.user),
    p = usePermissions();
  if (!initialized) return <LoadingState label="Checking management access…" />;
  const permissionAllowed = permission
    ? p.hasPermission(permission)
    : anyOf
      ? p.hasAnyPermission(...anyOf)
      : allOf
        ? p.hasAllPermissions(...allOf)
        : true;
  const allowed = Boolean(user) && permissionAllowed && scopeAllowed;
  return allowed
    ? children
    : (fallback ?? (
        <div className="forbidden">
          <b>403</b>
          <h1>Access denied</h1>
          <p>This page is not available for your account or assigned scope.</p>
          <Link className="button" href="/management/dashboard">
            Return to dashboard
          </Link>
        </div>
      ));
}
