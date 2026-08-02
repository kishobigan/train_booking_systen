import { apiClient } from '../http/api-client';
import { unwrap } from '../http/api-response';
import { createResourceService } from './resource.service';
import { Journey, Station } from '@/types/domain';

export const stationService = createResourceService<Station>('/stations');
export const routeService = createResourceService<Record<string, unknown>>('/routes');
export const journeyService = { ...createResourceService<Journey>('/journeys'), search: async (params: Record<string, unknown>) => unwrap<Journey[]>((await apiClient.get('/journeys/search', { params })).data) };
export const bookingService = { ...createResourceService<Record<string, unknown>>('/bookings'), createIdempotent: async (input: unknown, key: string) => unwrap((await apiClient.post('/bookings', input, { headers: { 'Idempotency-Key': key } })).data), cancel: async (id: string) => unwrap((await apiClient.post(`/bookings/${id}/cancel`)).data) };
export const paymentService = { ...createResourceService<Record<string, unknown>>('/payments'), initiate: async (input: unknown, key: string) => unwrap((await apiClient.post('/payments', input, { headers: { 'Idempotency-Key': key } })).data), status: async (id: string) => unwrap((await apiClient.get(`/payments/${id}/status`)).data) };
export const waitlistService = createResourceService<Record<string, unknown>>('/waitlist');
export const notificationService = createResourceService<Record<string, unknown>>('/notifications');
export const userService = createResourceService<Record<string, unknown>>('/users');
export const reportService = { summary: async (params?: Record<string, unknown>) => unwrap((await apiClient.get('/reports/summary', { params })).data) };
export const fareService = { calculate: async (params: Record<string, unknown>) => unwrap((await apiClient.get('/fares/calculate', { params })).data) };
export const availabilityService = { get: async (params: Record<string, unknown>) => unwrap((await apiClient.get('/availability', { params })).data) };
