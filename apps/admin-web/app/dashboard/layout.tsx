'use client';

// Client Component for the same reason as app/(user)/app/layout.tsx: icon
// components in NAV_ITEMS cannot cross the server/client boundary.

import { LayoutGrid, Radio, Users, BarChart3 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import type { NavItem } from '@/components/layout/nav-items';

// No entry for /dashboard itself: it only redirects to /dashboard/sos, so a
// tab pointing at it would be a tab that is never the active one.
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard/sos', label: 'SOS', icon: Radio },
  { href: '/dashboard/circles', label: 'Circles', icon: LayoutGrid },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={NAV_ITEMS}
      title="FindFam Admin"
      homeHref="/dashboard/sos"
      logoutEndpoint="/api/admin/logout"
    >
      {children}
    </AppShell>
  );
}
