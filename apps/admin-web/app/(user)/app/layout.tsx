'use client';

// A Client Component, because NAV_ITEMS carries icon *components* and a
// Server Component cannot pass those across the boundary — React has no way
// to serialise a function. The alternative is passing icon names and mapping
// them back inside AppShell, which buys nothing: this file fetches nothing
// and holds no secrets, so there is no reason for it to run on the server.

import { Home, Map, Users, UserPlus, UserCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import type { NavItem } from '@/components/layout/nav-items';

// `exact` on the overview because /app is a prefix of every other href here —
// without it the overview would read as active on all four pages.
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/app', label: 'Home', icon: Home, exact: true },
  { href: '/app/map', label: 'Map', icon: Map },
  { href: '/app/circles', label: 'Circles', icon: Users },
  { href: '/app/people', label: 'People', icon: UserPlus },
  { href: '/app/profile', label: 'Profile', icon: UserCircle },
];

export default function UserAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={NAV_ITEMS}
      title="FindFam"
      homeHref="/app"
      logoutEndpoint="/api/auth/logout"
    >
      {children}
    </AppShell>
  );
}
