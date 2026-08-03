import { apiClient } from '@/services/http/api-client';
import { unwrap } from '@/services/http/api-response';
import { AdminMode } from './dashboard.service';
const reportBase = (mode: AdminMode) => (mode === 'staff' ? '/staff/manage' : `/${mode}`);
export const adminReportService = {
  getRevenue: async (mode: AdminMode, params?: Record<string, unknown>) =>
    unwrap<Record<string, any>>(
      (await apiClient.get(`${reportBase(mode)}/reports/revenue`, { params })).data,
    ),
  getOccupancy: async (mode: AdminMode, params?: Record<string, unknown>) =>
    unwrap<Record<string, any>>(
      (await apiClient.get(`${reportBase(mode)}/reports/occupancy`, { params })).data,
    ),
  getJourneyOccupancy: async (mode: AdminMode, id: string) =>
    unwrap<Record<string, any>>(
      (await apiClient.get(`${reportBase(mode)}/journeys/${id}/occupancy`)).data,
    ),
};
