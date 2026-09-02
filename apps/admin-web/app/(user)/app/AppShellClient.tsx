'use client';

// A Client Component, because NAV_ITEMS carries icon *components* and a
// Server Component cannot pass those across the boundary — React has no way
// to serialise a function. Split out of layout.tsx so that file can be an
// async Server Component and run the profile-completion gate, which needs
// to fetch the current user.

import { Home, Map, Users, UserPlus, UserCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import type { NavItem } from '@/components/layout/nav-items';

// `exact` on the overview because /app is a prefix of every other href here —
// without it the overview would read as active on all the other pages.
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/app', label: 'Home', icon: Home, exact: true },
  { href: '/app/map', label: 'Map', icon: Map },
  { href: '/app/circles', label: 'Circles', icon: Users },
  { href: '/app/people', label: 'People', icon: UserPlus },
  { href: '/app/profile', label: 'Profile', icon: UserCircle },
];

export function AppShellClient({ children }: { children: React.ReactNode }) {
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
