'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { isNavItemActive, type NavItem } from './nav-items';

/**
 * The primary navigation below `lg`, where a 224px sidebar is a third of the
 * viewport and cannot be dismissed.
 *
 * The sliding pill is the one place a shared-element transition genuinely
 * earns its keep: it shows the relationship between where you were and where
 * you are, which four independently-fading backgrounds do not. It is also
 * purely decorative — `aria-current` carries the meaning, so a reader who
 * never sees the pill loses nothing.
 */
export function BottomNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-glass-border bg-glass pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const isActive = isNavItemActive(item, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                // min-h-[3.25rem] keeps the touch target above the 44px floor
                // even though the label is only ~10px tall.
                className={cn(
                  'relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-brand-soft' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isActive ? (
                  <motion.span
                    // Shared across all four items, so framer-motion animates
                    // the same element between them instead of crossfading
                    // four separate ones.
                    layoutId="bottom-nav-pill"
                    aria-hidden="true"
                    className="absolute inset-x-2 inset-y-1 -z-10 rounded-lg bg-brand/15"
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 420, damping: 34 }
                    }
                  />
                ) : null}
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
