'use client';
import { ReactNode, useState } from 'react';
import { ManagementSidebar } from './ManagementSidebar';
import { ManagementHeader } from './ManagementHeader';
import { ProtectedManagementRoute } from '@/components/auth/ProtectedManagementRoute';
export function ManagementShell({ children }: { children: ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <ProtectedManagementRoute>
      <div className="management-shell">
        <ManagementSidebar open={navigationOpen} close={() => setNavigationOpen(false)} />
        {navigationOpen && (
          <button
            className="management-backdrop"
            aria-label="Close management navigation"
            onClick={() => setNavigationOpen(false)}
          />
        )}
        <div className="management-workspace">
          <ManagementHeader openNavigation={() => setNavigationOpen(true)} />
          <main id="main-content" className="management-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </ProtectedManagementRoute>
  );
}
