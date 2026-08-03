'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { adminReportService } from '@/services/admin/report.service';
import { useAdminContext } from './useAdminContext';
import { useAuthStore } from '@/store/auth.store';
export function useRevenueReport(params: Record<string, unknown> = {}) {
  const { mode } = useAdminContext();
  return useQuery({
    queryKey: queryKeys.reports.revenue(params),
    queryFn: () => adminReportService.getRevenue(mode, params),
  });
}
export function useOccupancyReport(params: Record<string, unknown> = {}) {
  const { mode } = useAdminContext();
  const role = useAuthStore((s) => s.user?.role);
  const effectiveMode = role === 'STAFF' ? 'staff' : mode;
  return useQuery({
    queryKey: queryKeys.reports.occupancy(params),
    queryFn: () => adminReportService.getOccupancy(effectiveMode, params),
  });
}
