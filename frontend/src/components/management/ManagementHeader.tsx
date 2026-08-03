'use client';
import { LogOut, Menu } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/modules/auth.service';
import { socketManager } from '@/services/websocket/socket-manager';
export function ManagementHeader({ openNavigation }: { openNavigation: () => void }) {
  const user = useAuthStore((s) => s.user),
    queryClient = useQueryClient();
  const logout = async () => {
    try {
      await authService.logout();
    } catch {
    } finally {
      socketManager.disconnect();
      queryClient.clear();
      useAuthStore.getState().clear();
      location.assign('/login');
    }
  };
  return (
    <header className="management-header">
      <button className="menu-toggle" type="button" aria-label="Open management navigation" onClick={openNavigation}>
        <Menu />
      </button>
      <div>
        <b>{user?.fullName}</b>
        <span>{user?.role?.replaceAll('_', ' ')}</span>
      </div>
      <button className="button button-secondary" onClick={logout}>
        <LogOut size={17} /> Sign out
      </button>
    </header>
  );
}
