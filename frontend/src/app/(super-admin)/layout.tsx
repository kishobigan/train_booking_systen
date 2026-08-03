import { AuthProvider } from '@/providers/AuthProvider';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
