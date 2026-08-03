import { JourneyScopeGuard } from '@/components/auth/ScopeGuards';
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ journeyId: string }>;
}) {
  return <JourneyScopeGuard journeyId={(await params).journeyId}>{children}</JourneyScopeGuard>;
}
