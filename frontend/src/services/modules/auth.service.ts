import { apiClient } from '../http/api-client';
import { unwrap } from '../http/api-response';
import { User } from '@/types/domain';
export const authService = {
  login: async (input: { email: string; password: string }) => unwrap<{ user: User; accessToken: string }>((await apiClient.post('/auth/login', input)).data),
  me: async () => unwrap<User>((await apiClient.get('/auth/me')).data),
  logout: async () => { await apiClient.post('/auth/logout'); },
  changePassword: async (input: { currentPassword?: string; newPassword: string }) => unwrap((await apiClient.post('/auth/change-initial-password', input)).data),
};
