import { Home, Map, Users, UserPlus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import type { NavItem } from '@/components/layout/nav-items';

// `exact` on the overview because /app is a prefix of every other href here —
// without it the overview would read as active on all four pages.
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/app', label: 'Home', icon: Home, exact: true },
  { href: '/app/map', label: 'Map', icon: Map },
  { href: '/app/circles', label: 'Circles', icon: Users },
  { href: '/app/people', label: 'People', icon: UserPlus },
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
