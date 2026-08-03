import { apiClient, refreshAccessToken } from '../http/api-client';
import { unwrap } from '../http/api-response';
import { User } from '@/types/domain';
export type LoginResult = {
  requiresPasswordChange: boolean;
  user: User;
  accessToken?: string;
  passwordChangeToken?: string;
};
export const authService = {
  login: async (input: { email: string; password: string }) =>
    unwrap<LoginResult>(
      (await apiClient.post('/auth/login', { identifier: input.email, password: input.password }))
        .data,
    ),
  refresh: refreshAccessToken,
  me: async () => unwrap<User>((await apiClient.get('/auth/me')).data),
  logout: async () => {
    await apiClient.post('/auth/logout');
  },
  changeInitialPassword: async (input: {
    token: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    unwrap<{ user: User; accessToken: string }>(
      (
        await apiClient.post(
          '/auth/change-initial-password',
          {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
            confirmPassword: input.confirmPassword,
          },
          { headers: { Authorization: `Bearer ${input.token}` } },
        )
      ).data,
    ),
};
