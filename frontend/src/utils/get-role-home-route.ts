import { ROLES } from '@/constants/roles';
export function getRoleHomeRoute(user?: { role?: string } | null) {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF].includes(user?.role as never)
    ? '/management/dashboard'
    : '/';
}
export function safeReturnTo(value: string | null) {
  return value?.startsWith('/management/') && !value.startsWith('//') ? value : null;
}
