'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUsers } from '@/hooks/api/admin/useUsers';
import { DataTable, Column } from '@/components/data-table/DataTable';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ErrorState } from '@/components/ui/StatusState';
import { PERMISSIONS as P } from '@/constants/permissions';
import { adminUserService } from '@/services/admin/user.service';
import { useAuthStore } from '@/store/auth.store';

export function UserManagementView() {
  const q = useUsers();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const rows = Array.isArray(q.data) ? q.data : q.data?.items;
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });
  const block = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminUserService.block(true, id, reason),
    onSuccess: refresh,
  });
  const unblock = useMutation({
    mutationFn: (id: string) => adminUserService.unblock(true, id),
    onSuccess: refresh,
  });

  const blockUser = (user: any) => {
    const reason = window.prompt(`Why should ${user.fullName} be blocked?`);
    if (!reason?.trim()) return;
    if (!window.confirm(`Block ${user.fullName} and immediately revoke portal access?`)) return;
    block.mutate({ id: user.id, reason: reason.trim() });
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <Link href={`/management/users/${row.id}`}>{row.fullName}</Link>,
    },
    { key: 'email', header: 'Email', cell: (row) => row.email },
    {
      key: 'role',
      header: 'Role',
      cell: (row) => <span className="badge">{row.role?.replaceAll('_', ' ')}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className={`badge ${row.blockedAt || row.isActive === false ? 'badge-danger' : ''}`}>
          {row.blockedAt ? 'Blocked' : row.isActive === false ? 'Inactive' : 'Active'}
        </span>
      ),
    },
    {
      key: 'scope',
      header: 'Allocation',
      cell: (row) =>
        row.role === 'ADMIN' || row.role === 'STAFF' ? (
          <Link className="button button-secondary" href={`/management/users/${row.id}`}>
            {row.role === 'ADMIN' ? 'Allocate trains' : 'Allocate stations'}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'access',
      header: 'Portal access',
      cell: (row) => {
        if (!isSuperAdmin || row.id === currentUser?.id) return '—';
        const blocked = Boolean(row.blockedAt || row.isActive === false);
        return blocked ? (
          <button className="button" disabled={unblock.isPending} onClick={() => unblock.mutate(row.id)}>
            Unblock
          </button>
        ) : (
          <button className="button button-secondary" disabled={block.isPending} onClick={() => blockUser(row)}>
            Block access
          </button>
        );
      },
    },
  ];

  return (
    <div className="stack">
      <div className="management-title">
        <div>
          <h1>Users and allocations</h1>
          <p>Allocate trains to Admins, allocate stations to Staff, and control portal access.</p>
        </div>
        <PermissionGuard anyOf={[P.USER_CREATE_SUPER_ADMIN, P.USER_CREATE_ADMIN, P.USER_CREATE_STAFF]}>
          <Link className="button" href="/management/users/new">Create user</Link>
        </PermissionGuard>
      </div>
      {(block.error || unblock.error) && <ErrorState message={(block.error || unblock.error)?.message || 'Unable to update access'} />}
      <DataTable caption="Users" columns={columns} rows={rows} loading={q.isLoading} error={q.error} retry={() => q.refetch()} emptyMessage="No managed users were found." />
    </div>
  );
}
