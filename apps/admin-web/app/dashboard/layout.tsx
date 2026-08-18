'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Radio, Users, BarChart3, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard/circles', label: 'Circles', icon: LayoutGrid },
  { href: '/dashboard/sos', label: 'SOS', icon: Radio },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-glass-border bg-glass px-3 py-6 backdrop-blur-xl">
        <div className="mb-8 px-3 text-lg font-semibold tracking-tight">FindFam Admin</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border border-brand/30 bg-brand/15 text-brand-soft'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
