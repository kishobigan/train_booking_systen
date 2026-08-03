'use client';
import { PermissionPageGuard } from './PermissionPageGuard';
import { useAccessScope } from '@/hooks/useAccessScope';
export function JourneyScopeGuard({
  journeyId,
  children,
}: {
  journeyId: string;
  children: React.ReactNode;
}) {
  const scope = useAccessScope();
  return (
    <PermissionPageGuard scopeAllowed={scope.canAccessJourney(journeyId)}>
      {children}
    </PermissionPageGuard>
  );
}
export function StationScopeGuard({
  stationId,
  children,
}: {
  stationId: string;
  children: React.ReactNode;
}) {
  const scope = useAccessScope();
  return (
    <PermissionPageGuard scopeAllowed={scope.canAccessStation(stationId)}>
      {children}
    </PermissionPageGuard>
  );
}
