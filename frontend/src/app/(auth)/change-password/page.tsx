'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { authService } from '@/services/modules/auth.service';
import { AUTH_STATUS, useAuthStore } from '@/store/auth.store';
import { getRoleHomeRoute } from '@/utils/get-role-home-route';
export default function ChangePasswordPage() {
  const router = useRouter();
  const { status, user, restrictedPasswordChangeToken } = useAuthStore();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>();
  useEffect(() => {
    if (status === AUTH_STATUS.UNAUTHENTICATED) router.replace('/login');
  }, [router, status]);
  const submit = handleSubmit(async (values) => {
    try {
      if (!restrictedPasswordChangeToken) throw new Error('Password-change session is missing');
      const result = await authService.changeInitialPassword({
        token: restrictedPasswordChangeToken,
        ...values,
      });
      useAuthStore.getState().setAuthenticated(result);
      router.replace(getRoleHomeRoute(result.user));
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Password change failed',
      });
    }
  });
  return (
    <div className="shell">
      <Card className="auth-card">
        <div className="page-heading">
          <h1>Set a permanent password</h1>
          <p className="muted">
            Required before {user?.fullName || 'this account'} can enter the management portal.
          </p>
        </div>
        <form className="stack" onSubmit={submit}>
          {errors.root && <div className="form-alert">{errors.root.message}</div>}
          <div className="field">
            <label>Temporary password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              {...register('currentPassword', { required: true })}
            />
          </div>
          <div className="field">
            <label>New password</label>
            <input
              className="input"
              type="password"
              minLength={12}
              autoComplete="new-password"
              {...register('newPassword', { required: true, minLength: 12 })}
            />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input
              className="input"
              type="password"
              minLength={12}
              autoComplete="new-password"
              {...register('confirmPassword', {
                required: true,
                validate: (value, form) => value === form.newPassword || 'Passwords do not match',
              })}
            />
            {errors.confirmPassword && (
              <span className="field-error">{errors.confirmPassword.message}</span>
            )}
          </div>
          <button className="button" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Set password and continue'}
          </button>
        </form>
      </Card>
    </div>
  );
}
