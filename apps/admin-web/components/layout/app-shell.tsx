'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlowBackdrop } from '@/components/ui/glow-backdrop';
import { BottomNav } from './bottom-nav';
import { isNavItemActive, type NavItem } from './nav-items';

/**
 * The chrome shared by both signed-in surfaces.
 *
 * `/app` and `/dashboard` were near-identical copies of the same sidebar, and
 * both were broken below `lg` in exactly the same way — a fixed 224px rail on
 * a 375px screen with no way to collapse it. Fixing that twice would have
 * meant keeping two fixes in step, so there is one shell:
 *
 *   lg and up   a glass sidebar, visually unchanged from before
 *   below lg    a slim sticky top bar plus a fixed bottom nav
 */
export function AppShell({
  navItems,
  title,
  homeHref,
  logoutEndpoint,
  children,
}: {
  navItems: readonly NavItem[];
  title: string;
  homeHref: string;
  logoutEndpoint: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch(logoutEndpoint, { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden lg:flex-row">
      <GlowBackdrop className="opacity-40" />

      {/* Mobile top bar — identity and the account action, so the bottom nav
          stays purely navigational rather than mixing in a destructive one. */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-glass-border bg-glass px-4 backdrop-blur-xl lg:hidden">
        <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5 text-brand" />
          {title}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Log out</span>
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-glass-border bg-glass px-3 py-6 backdrop-blur-xl lg:flex">
        <Link
          href={homeHref}
          className="mb-8 flex items-center gap-2 px-3 text-lg font-semibold tracking-tight"
        >
          <ShieldCheck className="h-5 w-5 text-brand" />
          {title}
        </Link>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-[background-color,box-shadow,color]',
                  isActive
                    ? 'border-brand/30 bg-brand/15 text-brand-soft shadow-glow'
                    : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
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

      {/*
       * A flex column, not a plain block, so a page can opt into filling the
       * viewport with `flex-1 min-h-0` (the map does) instead of computing a
       * height like `calc(100vh-4rem)` that has to be kept in sync by hand
       * with however many bars happen to be on screen at this breakpoint.
       *
       * pb-24 clears the fixed bottom nav; without it the last row of any
       * list sits underneath it.
       */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
        {children}
      </main>

      <BottomNav items={navItems} />
    </div>
  );
}
