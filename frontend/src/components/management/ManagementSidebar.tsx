'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrainFront, X } from 'lucide-react';
import { managementNavigation } from '@/config/management-navigation';
import { usePermissions } from '@/hooks/usePermissions';

export function ManagementSidebar({ open, close }: { open: boolean; close: () => void }) {
  const path = usePathname();
  const permissions = usePermissions();
  const items = managementNavigation.filter((item) =>
    item.permission
      ? permissions.hasPermission(item.permission)
      : item.anyOf
        ? permissions.hasAnyPermission(...item.anyOf)
        : true,
  );

  return (
    <aside className={`management-sidebar${open ? ' open' : ''}`} aria-label="Management navigation">
      <div className="management-sidebar-heading">
        <Link className="management-brand" href="/management/dashboard" onClick={close}>
          <TrainFront aria-hidden />
          <span>Railway Operations</span>
        </Link>
        <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={close}>
          <X aria-hidden />
        </button>
      </div>
      <nav aria-label="Management">
        {items.map((item) => {
          const Icon = item.icon;
          const active = path.startsWith(item.href);
          return (
            <Link key={item.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} href={item.href} onClick={close}>
              <Icon size={19} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
