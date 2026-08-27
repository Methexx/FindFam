'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Menu, X, ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface SiteNavSection {
  href: string;
  label: string;
}

const SECTIONS: readonly SiteNavSection[] = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'FAQ' },
];

/**
 * Tracks which section is on screen, so the nav can say where you are.
 *
 * rootMargin pulls the detection line down from the top of the viewport and
 * up from the bottom, leaving a band across the middle: a section counts as
 * "current" once it reaches roughly the middle of the screen, rather than the
 * instant a single pixel of it appears. Without that the highlight flickers
 * between two sections at every boundary.
 */
function useActiveSection(hrefs: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = hrefs
      .map((href) => document.querySelector(href))
      .filter((element): element is Element => element !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(`#${visible[0].target.id}`);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [hrefs]);

  return active;
}

export function SiteNav({
  hasUserSession,
  hasAdminSession,
  primaryHref,
  primaryLabel,
}: {
  hasUserSession: boolean;
  hasAdminSession: boolean;
  primaryHref: string;
  primaryLabel: string;
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(SECTIONS.map((section) => section.href));

  // Solidifies once the page has moved at all. `passive` because this handler
  // never calls preventDefault, and a non-passive scroll listener blocks the
  // compositor on every frame of a scroll.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-4 z-20 px-4">
      <div
        className={cn(
          'mx-auto flex h-14 max-w-4xl items-center justify-between rounded-full px-5 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
          isScrolled
            ? 'border border-glass-border bg-glass shadow-lg shadow-black/20 backdrop-blur-xl'
            : 'border border-transparent bg-transparent',
        )}
      >
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5 text-brand" />
          FindFam
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.href;
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'relative rounded-full px-3 py-1.5 text-sm transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {section.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-3 -bottom-0.5 h-px origin-center bg-brand transition-transform duration-300',
                    isActive ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {hasAdminSession ? (
            <Link href="/dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open dashboard
            </Link>
          ) : (
            <>
              {!hasUserSession ? (
                <Link
                  href="/login"
                  className="hidden px-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  Log in
                </Link>
              ) : null}
              <Link
                href={primaryHref}
                className={buttonVariants({ variant: 'gradient', size: 'sm' })}
              >
                {primaryLabel}
              </Link>
            </>
          )}

          {/* Below md the section links above are hidden and previously had no
              replacement at all — How it works, Features, Privacy and FAQ were
              simply unreachable from the nav on a phone. */}
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </DialogTrigger>

            {/* Radix Dialog rather than a hand-rolled disclosure: focus
                trapping, Escape, scroll locking and aria-modal come with it,
                and all four are things a hand-rolled menu gets wrong. */}
            <DialogContent className="left-1/2 top-4 max-w-[calc(100%-2rem)] translate-y-0 rounded-2xl p-5 sm:max-w-sm">
              <div className="mb-4 flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-brand" />
                  FindFam
                </DialogTitle>
                <DialogClose
                  aria-label="Close menu"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </DialogClose>
              </div>

              <nav aria-label="Sections" className="flex flex-col">
                {SECTIONS.map((section) => (
                  <Link
                    key={section.href}
                    href={section.href}
                    // Closes on navigation: an in-page anchor does not
                    // remount anything, so nothing else would dismiss it and
                    // the menu would sit over the section just jumped to.
                    onClick={() => setMenuOpen(false)}
                    className="border-b border-border py-3 text-sm text-muted-foreground transition-colors last:border-0 hover:text-foreground"
                  >
                    {section.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={primaryHref}
                  onClick={() => setMenuOpen(false)}
                  className={buttonVariants({ variant: 'gradient' })}
                >
                  {primaryLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                {!hasUserSession && !hasAdminSession ? (
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    Log in
                  </Link>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
