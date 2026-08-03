import { StationScopeGuard } from '@/components/auth/ScopeGuards';
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ stationId: string }>;
}) {
  return <StationScopeGuard stationId={(await params).stationId}>{children}</StationScopeGuard>;
}
