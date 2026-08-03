import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main id="main-content" className="app-main public-main" tabIndex={-1}>
        {children}
      </main>
      <AppFooter />
    </>
  );
}
