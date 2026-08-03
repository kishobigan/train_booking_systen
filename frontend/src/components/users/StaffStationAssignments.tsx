'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminUserService } from '@/services/admin/user.service';
import { stationManagementService } from '@/services/admin/management.service';
import { DataTable, Column } from '@/components/data-table/DataTable';
import { ErrorState } from '@/components/ui/StatusState';

export function StaffStationAssignments({ staffId }: { staffId: string }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const assignments = useQuery({
    queryKey: ['users', staffId, 'stations'],
    queryFn: () => adminUserService.assignedStations(staffId),
  });
  const stations = useQuery({
    queryKey: ['management', 'stations', 'assignment-picker'],
    queryFn: () => stationManagementService.list({ limit: 100, isActive: true }),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['users', staffId, 'stations'] });
    client.invalidateQueries({ queryKey: ['users', staffId] });
  };
  const assign = useMutation({
    mutationFn: () => adminUserService.assignStations(staffId, selected),
    onSuccess: () => {
      setSelected([]);
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (stationId: string) =>
      adminUserService.revokeStation(staffId, stationId, 'Responsibility revoked by Super Admin'),
    onSuccess: refresh,
  });
  const assignedIds = new Set(
    (assignments.data || []).map((a: any) => a.stationId || a.station?.id),
  );
  const columns: Column<any>[] = [
    {
      key: 'station',
      header: 'Station',
      cell: (a) => (
        <Link href={`/management/stations/${a.station?.id}`}>
          <b>{a.station?.code}</b> · {a.station?.name}
        </Link>
      ),
    },
    {
      key: 'assignedAt',
      header: 'Assigned',
      cell: (a) => new Date(a.assignedAt || a.createdAt).toLocaleString(),
    },
    { key: 'assignedBy', header: 'Assigned by', cell: (a) => a.assignedBy?.fullName || '—' },
    {
      key: 'action',
      header: 'Action',
      cell: (a) => (
        <button
          className="button button-secondary"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(a.stationId || a.station.id)}
        >
          Revoke
        </button>
      ),
    },
  ];
  return (
    <div className="stack">
      <h2>Assigned stations</h2>
      <DataTable
        caption="Assigned stations"
        columns={columns}
        rows={assignments.data || []}
        loading={assignments.isLoading}
        error={assignments.error}
        emptyMessage="No stations are assigned to this Staff account."
      />
      <h2>Assign stations</h2>
      <div className="stack">
        {stations.data?.items
          .filter((s: any) => !assignedIds.has(s.id))
          .map((s: any) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id),
                  )
                }
              />{' '}
              {s.code} · {s.name}
            </label>
          ))}
      </div>
      {(assign.error || stations.error) && (
        <ErrorState
          message={(assign.error || stations.error)?.message || 'Unable to load stations'}
        />
      )}
      <button
        className="button"
        disabled={!selected.length || assign.isPending}
        onClick={() => assign.mutate()}
      >
        {assign.isPending ? 'Assigning…' : 'Assign selected stations'}
      </button>
    </div>
  );
}
