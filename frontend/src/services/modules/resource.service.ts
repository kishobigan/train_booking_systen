import { apiClient } from '../http/api-client';
import { unwrap } from '../http/api-response';
export function createResourceService<T>(path: string) {
  return {
    list: async (params?: Record<string, unknown>) => unwrap<T[]>((await apiClient.get(path, { params })).data),
    get: async (id: string) => unwrap<T>((await apiClient.get(`${path}/${id}`)).data),
    create: async (input: Partial<T>) => unwrap<T>((await apiClient.post(path, input)).data),
    update: async (id: string, input: Partial<T>) => unwrap<T>((await apiClient.patch(`${path}/${id}`, input)).data),
    remove: async (id: string) => { await apiClient.delete(`${path}/${id}`); },
  };
}
