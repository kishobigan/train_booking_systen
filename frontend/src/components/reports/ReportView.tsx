'use client';
import { useOccupancyReport, useRevenueReport } from '@/hooks/api/admin/useReports';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/StatusState';
import { DataTable } from '@/components/data-table/DataTable';
export function RevenueReportView() {
  const q = useRevenueReport();
  if (q.isLoading) return <LoadingState label="Loading revenue report…" />;
  if (q.isError) return <ErrorState message={q.error.message} retry={() => q.refetch()} />;
  const d = q.data || {};
  return (
    <div className="stack">
      <h1>Revenue report</h1>
      <div className="metric-grid">
        <Metric label="Gross revenue" value={money(d.grossRevenue)} />
        <Metric label="Refunds" value={money(d.refundTotal)} />
        <Metric label="Net revenue" value={money(d.netRevenue)} />
        <Metric label="Payments" value={d.paymentCount} />
      </div>
      <DataTable
        caption="Revenue by journey"
        columns={[
          { key: 'journey', header: 'Journey', cell: (r: any) => r.serviceNumber || r.journeyId },
          { key: 'gross', header: 'Gross', cell: (r: any) => money(r.grossRevenue) },
          { key: 'net', header: 'Net', cell: (r: any) => money(r.netRevenue) },
        ]}
        rows={d.byJourney || []}
        emptyMessage="No successful payments were found for this period."
      />
    </div>
  );
}
export function OccupancyReportView() {
  const q = useOccupancyReport();
  if (q.isLoading) return <LoadingState label="Loading segment occupancy…" />;
  if (q.isError) return <ErrorState message={q.error.message} retry={() => q.refetch()} />;
  const d = q.data || {};
  return (
    <div className="stack">
      <h1>Occupancy report</h1>
      <div className="metric-grid">
        <Metric
          label="Average occupancy"
          value={`${Number(d.averageOccupancy || 0).toFixed(1)}%`}
        />
        <Metric label="Peak occupancy" value={`${Number(d.peakOccupancy || 0).toFixed(1)}%`} />
      </div>
      <DataTable
        caption="Journey occupancy"
        columns={[
          { key: 'journey', header: 'Journey', cell: (r: any) => r.serviceNumber || r.journeyId },
          { key: 'segment', header: 'Segment', cell: (r: any) => r.segment || '—' },
          {
            key: 'occupancy',
            header: 'Occupancy',
            cell: (r: any) => `${Number(r.occupancyPercentage || 0).toFixed(1)}%`,
          },
        ]}
        rows={d.journeys || d.byJourney || []}
        emptyMessage="No journey occupancy data is available for the selected filters."
      />
    </div>
  );
}
function Metric({ label, value }: { label: string; value: any }) {
  return (
    <Card className="metric-card">
      <div>
        <small>{label}</small>
        <b>{value ?? '—'}</b>
      </div>
    </Card>
  );
}
const money = (v: any) => `LKR ${Number(v || 0).toFixed(2)}`;
