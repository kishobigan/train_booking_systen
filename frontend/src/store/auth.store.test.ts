import { beforeEach, describe, expect, it } from 'vitest';
import { authTokenStore } from '@/services/http/auth-token-store';
import { AUTH_STATUS, useAuthStore } from './auth.store';
const user = {
  id: 'user-1',
  email: 'admin@example.com',
  fullName: 'Admin',
  role: 'ADMIN' as const,
};
describe('authentication state', () => {
  beforeEach(() => useAuthStore.getState().setUnauthenticated());
  it('distinguishes loading, authenticated, and unauthenticated states', () => {
    useAuthStore.getState().setLoading();
    expect(useAuthStore.getState()).toMatchObject({
      status: AUTH_STATUS.LOADING,
      initialized: false,
    });
    useAuthStore.getState().setAuthenticated({ user, accessToken: 'memory-token' });
    expect(useAuthStore.getState()).toMatchObject({
      status: AUTH_STATUS.AUTHENTICATED,
      initialized: true,
      user,
    });
    expect(authTokenStore.getAccessToken()).toBe('memory-token');
    useAuthStore.getState().clear();
    expect(authTokenStore.getAccessToken()).toBeNull();
  });
  it('keeps password-change credentials separate from access tokens', () => {
    useAuthStore.getState().setPasswordChangeRequired({ user, token: 'restricted' });
    expect(useAuthStore.getState().status).toBe(AUTH_STATUS.PASSWORD_CHANGE_REQUIRED);
    expect(useAuthStore.getState().restrictedPasswordChangeToken).toBe('restricted');
    expect(authTokenStore.getAccessToken()).toBeNull();
  });
});
