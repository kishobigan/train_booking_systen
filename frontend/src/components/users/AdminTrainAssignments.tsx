'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminUserService } from '@/services/admin/user.service';
import { trainManagementService } from '@/services/admin/management.service';
import { DataTable, Column } from '@/components/data-table/DataTable';
import { ErrorState, LoadingState } from '@/components/ui/StatusState';
import { StaffStationAssignments } from './StaffStationAssignments';
export function AdminTrainAssignments({ adminId }: { adminId: string }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const user = useQuery({
    queryKey: ['users', adminId],
    queryFn: () => adminUserService.get(true, adminId),
  });
  const assignments = useQuery({
    queryKey: ['users', adminId, 'trains'],
    queryFn: () => adminUserService.assignedTrains(adminId),
    enabled: user.data?.role === 'ADMIN',
  });
  const trains = useQuery({
    queryKey: ['management', 'trains', 'assignment-picker'],
    queryFn: () => trainManagementService.list({ limit: 100, status: 'ACTIVE' }),
    enabled: user.data?.role === 'ADMIN',
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['users', adminId] });
    client.invalidateQueries({ queryKey: ['management', 'trains'] });
  };
  const assign = useMutation({
    mutationFn: () => adminUserService.assignTrains(adminId, selected),
    onSuccess: () => {
      setSelected([]);
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (trainId: string) =>
      adminUserService.revokeTrain(adminId, trainId, 'Responsibility revoked by Super Admin'),
    onSuccess: refresh,
  });
  if (user.isLoading) return <LoadingState />;
  if (user.error) return <ErrorState message={user.error.message} />;
  if (user.data?.role === 'STAFF')
    return (
      <div className="stack">
        <h1>{user.data.fullName}</h1>
        <StaffStationAssignments staffId={adminId} />
      </div>
    );
  if (user.data?.role !== 'ADMIN')
    return (
      <div className="stack">
        <h1>{user.data?.fullName}</h1>
        <p>Operational assignments apply only to Admin and Staff accounts.</p>
      </div>
    );
  const assignedIds = new Set((assignments.data || []).map((a: any) => a.train?.id));
  const columns: Column<any>[] = [
    {
      key: 'train',
      header: 'Train',
      cell: (a) => (
        <Link href={`/management/trains/${a.train?.id}`}>
          <b>{a.train?.trainNumber}</b> · {a.train?.name}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', cell: (a) => a.train?.status },
    { key: 'date', header: 'Assigned', cell: (a) => new Date(a.assignedAt).toLocaleString() },
    { key: 'by', header: 'Assigned by', cell: (a) => a.assignedBy?.fullName || '—' },
    {
      key: 'action',
      header: 'Action',
      cell: (a) => (
        <button
          className="button button-secondary"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(a.train.id)}
        >
          Revoke
        </button>
      ),
    },
  ];
  return (
    <div className="stack">
      <h1>{user.data.fullName}</h1>
      <h2>Assigned Trains</h2>
      <DataTable
        caption="Assigned trains"
        columns={columns}
        rows={assignments.data}
        loading={assignments.isLoading}
        error={assignments.error}
        emptyMessage="No trains are assigned to this Admin."
      />
      <h2>Assign trains</h2>
      <div className="stack">
        {trains.data?.items
          .filter((t: any) => !assignedIds.has(t.id))
          .map((t: any) => (
            <label key={t.id}>
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, t.id] : selected.filter((id) => id !== t.id),
                  )
                }
              />{' '}
              {t.trainNumber} · {t.name}
            </label>
          ))}
      </div>
      {assign.error && <ErrorState message={assign.error.message} />}
      <button
        className="button"
        disabled={!selected.length || assign.isPending}
        onClick={() => assign.mutate()}
      >
        {assign.isPending ? 'Assigning…' : 'Assign selected trains'}
      </button>
    </div>
  );
}
