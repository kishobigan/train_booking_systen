'use client';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { authService } from '@/services/modules/auth.service';
import { AUTH_STATUS, useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/services/http/api-error';
import { Button } from '@/components/ui/Button';
import { getRoleHomeRoute, safeReturnTo } from '@/utils/get-role-home-route';
const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must contain at least 8 characters.'),
});
type Values = z.infer<typeof schema>;
export function LoginForm() {
  const router = useRouter(),
    params = useSearchParams();
  const status = useAuthStore((s) => s.status),
    user = useAuthStore((s) => s.user),
    initialized = useAuthStore((s) => s.initialized);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (!initialized) return;
    if (status === AUTH_STATUS.AUTHENTICATED) router.replace(getRoleHomeRoute(user));
    if (status === AUTH_STATUS.PASSWORD_CHANGE_REQUIRED) router.replace('/change-password');
  }, [initialized, router, status, user]);
  const submit = handleSubmit(async (value) => {
    try {
      const session = await authService.login(value);
      if (session.requiresPasswordChange && session.passwordChangeToken) {
        useAuthStore
          .getState()
          .setPasswordChangeRequired({ user: session.user, token: session.passwordChangeToken });
        router.replace('/change-password');
        return;
      }
      if (!session.accessToken)
        throw new ApiError({ message: 'The server returned an incomplete login session.' });
      useAuthStore
        .getState()
        .setAuthenticated({ user: session.user, accessToken: session.accessToken });
      router.replace(safeReturnTo(params.get('returnTo')) || getRoleHomeRoute(session.user));
    } catch (error) {
      setError('root', { message: error instanceof ApiError ? error.message : 'Sign in failed.' });
    }
  });
  return (
    <form className="stack" onSubmit={submit} noValidate>
      {errors.root && (
        <div className="form-alert" role="alert">
          {errors.root.message}
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Staff email address</label>
        <input className="input" id="email" autoComplete="email" {...register('email')} />
        {errors.email && <span className="field-error">{errors.email.message}</span>}
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          className="input"
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && <span className="field-error">{errors.password.message}</span>}
      </div>
      <Button disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in to staff portal'}
      </Button>
    </form>
  );
}
