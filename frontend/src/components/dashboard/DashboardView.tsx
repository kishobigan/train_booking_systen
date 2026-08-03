'use client';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Ticket,
  TrainFront,
  Users,
} from 'lucide-react';
import { useDashboard } from '@/hooks/api/admin/useDashboard';
import { useAdminContext } from '@/hooks/api/admin/useAdminContext';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/StatusState';
export function DashboardView() {
  const { user, isSuperAdmin } = useAdminContext();
  const query = useDashboard();
  const mode = user?.role === 'STAFF' ? 'STATION' : isSuperAdmin ? 'SYSTEM' : 'JOURNEY';
  if (user?.role === 'STAFF')
    return (
      <div className="stack">
        <Header mode={mode} />
        <div className="metric-grid">
          <Metric
            label="Assigned stations"
            value={user.assignedStationIds?.length ?? 0}
            icon={<TrainFront />}
          />
          <Metric
            label="Scope status"
            value={user.assignedStationIds?.length ? 'Ready' : 'Not assigned'}
            icon={<AlertTriangle />}
          />
        </div>
        <Card>
          <h2>Station operations</h2>
          <p className="muted">
            Station-level dashboard data requires assigned station IDs and a staff-authorized
            backend endpoint.
          </p>
        </Card>
      </div>
    );
  if (query.isLoading) return <LoadingState label="Loading operational dashboard…" />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  const d = query.data || {};
  const metrics = [
    ['Journeys', d.totalJourneys ?? d.journeyCount ?? d.scope?.journeyCount, TrainFront],
    ['Today', d.journeysToday ?? d.todayJourneys, CalendarDays],
    ['Bookings', d.totalBookings ?? d.bookingCount ?? d.bookings?.total, Ticket],
    ['Net revenue', d.netRevenue ?? d.revenue?.netRevenue, CircleDollarSign],
    ['Pending payments', d.pendingBankSlips ?? d.payments?.awaiting_verification, AlertTriangle],
    ['Users', d.totalUsers, Users],
  ];
  return (
    <div className="stack">
      <Header mode={mode} />
      <div className="metric-grid">
        {metrics
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([label, value, Icon]: any) => (
            <Metric key={label} label={label} value={value} icon={<Icon />} />
          ))}
      </div>
      <div className="management-grid">
        <Card>
          <h2>Operational alerts</h2>
          {d.alerts?.length ? (
            d.alerts.map((alert: any) => <p key={alert.id || alert.message}>{alert.message}</p>)
          ) : (
            <p className="muted">No operational alerts.</p>
          )}
        </Card>
        <Card>
          <h2>Delayed journeys</h2>
          <p className="muted">{d.delayedJourneys ?? 0} journeys currently delayed.</p>
        </Card>
      </div>
    </div>
  );
}
function Header({ mode }: { mode: string }) {
  return (
    <div className="management-title">
      <div>
        <span className="eyebrow">{mode} VIEW</span>
        <h1>Operations dashboard</h1>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="metric-card">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{String(value)}</b>
      </div>
    </Card>
  );
}
